import express from "express";
import {
  LambdaClient,
  PutFunctionConcurrencyCommand,
} from "@aws-sdk/client-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// Env variables names used internally - duplicated in cdk code, should be deduplicated
const ENV_VARIABLE_REVANT_COST_TABLE_NAME = "REVANT_COST_TABLE_NAME";
const ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX = "REVANT_COST_LIMIT";

const lambdaClient = new LambdaClient({});
const dynamoDBClient = new DynamoDBClient({});
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient);

// Lambda extensions API variables
const LAMBDA_EXTENSION_API_BASE_URL = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-01-01/extension`;
const LAMBDA_EXTENSION_API_ID_HEADER_NAME = "lambda-extension-identifier";
const LAMBDA_EXTENSION_API_NAME_HEADER_NAME = "lambda-extension-name";

// Telemetry API variables
const LAMBDA_TELEMETRY_API_BASE_URL = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2022-07-01/telemetry`;

// Telemetry listener variables
const LISTENER_HOST = "sandbox.localdomain";
const LISTENER_PORT = 7654;

// Extension specific variables
const LAMBDA_EXTENSION_NAME = "revant";
const DYNAMODB_ACCRUED_EXPENSES_ATTRIBUTE_NAME = "accruedExpenses";
const DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME = "updatedAt";

const registerExtension = async (): Promise<{
  extensionId: string;
  functionName: string;
}> => {
  const response = await fetch(`${LAMBDA_EXTENSION_API_BASE_URL}/register`, {
    method: "post",
    headers: new Headers({
      "Content-Type": "application/json",
      [LAMBDA_EXTENSION_API_NAME_HEADER_NAME]: LAMBDA_EXTENSION_NAME,
    }),
    body: JSON.stringify({
      events: ["INVOKE", "SHUTDOWN"],
    }),
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(
      `[extensions-api:${LAMBDA_EXTENSION_NAME}] Registration failed. Reason: ${reason}`
    );
  }

  const extensionId = response.headers.get(LAMBDA_EXTENSION_API_ID_HEADER_NAME);
  if (extensionId === null) {
    throw new Error(
      `[extensions-api:${LAMBDA_EXTENSION_NAME}] No Extension ID specified in response. Received headers: ${response.headers}`
    );
  }

  const { functionName } = await response.json();

  console.info(
    `[extensions-api:${LAMBDA_EXTENSION_NAME}] Registration success with extensionId`,
    extensionId
  );
  return { extensionId, functionName };
};

interface InvokeEvent {
  eventType: "INVOKE";
}

interface ShutdownEvent {
  eventType: "SHUTDOWN";
  shutdownReason: "SPINDOWN" | "TIMEOUT" | "FAILURE";
  deadlineMs: number;
}

const next = async (
  extensionId: string
): Promise<InvokeEvent | ShutdownEvent> => {
  console.info(
    `[extensions-api:${LAMBDA_EXTENSION_NAME}] Waiting for next event`
  );
  const res = await fetch(`${LAMBDA_EXTENSION_API_BASE_URL}/event/next`, {
    method: "get",
    headers: new Headers({
      "Content-Type": "application/json",
      [LAMBDA_EXTENSION_API_ID_HEADER_NAME]: extensionId,
    }),
  });

  if (!res.ok) {
    const reason = await res.text();
    throw new Error(
      `[extensions-api:${LAMBDA_EXTENSION_NAME}] Failed receiving next event. Reason: ${reason}`
    );
  } else {
    const event = await res.json();
    console.info(
      `[extensions-api:${LAMBDA_EXTENSION_NAME}] Next event received of type:`,
      event.eventType
    );
    return event;
  }
};

const handleShutdown = (event: "SIGINT" | "SIGTERM" | "SHUTDOWN"): never => {
  console.info(
    `[extensions-api:${LAMBDA_EXTENSION_NAME}] Handling shutdown for event ${event}`
  );
  process.exit(0);
};

interface TelemetryEvent {
  time: string;
  type: string;
  record: Record<string, unknown>;
}

interface PlatformReportTelemetryEvent extends TelemetryEvent {
  type: "platform.report";
  record: {
    requestId: string;
    metrics: {
      billedDurationMs: string;
      memorySizeMB: string;
    };
  };
}

const isPlatformReportTelemetryEvent = (
  telemetryEvent: TelemetryEvent
): telemetryEvent is PlatformReportTelemetryEvent =>
  telemetryEvent.type === "platform.report";

const disableLambda = async (functionName: string) => {
  await lambdaClient.send(
    new PutFunctionConcurrencyCommand({
      FunctionName: functionName,
      ReservedConcurrentExecutions: 0,
    })
  );
};

const processTelemetryEvents = async (
  functionName: string,
  telemetryEvents: TelemetryEvent[]
) => {
  const platformReportTelemetryEvents = telemetryEvents.filter(
    isPlatformReportTelemetryEvent
  );

  if (platformReportTelemetryEvents.length === 0) {
    console.log(
      `[telementry-listener:${LAMBDA_EXTENSION_NAME}] No platform.report telemetry events to process`
    );
    return;
  }

  console.log(
    `[telementry-listener:${LAMBDA_EXTENSION_NAME}] ${platformReportTelemetryEvents.length} platform.report telemetry events received`
  );

  const newInvocationsCumulativeLambdaMetrics =
    platformReportTelemetryEvents.reduce<CumulativeLambdaMetrics>(
      (cumulativeLambdaMetrics, telementryEvent) => {
        const {
          record: {
            requestId,
            metrics: { billedDurationMs, memorySizeMB },
          },
        } = telementryEvent;

        console.log(
          `[telementry-listener:${LAMBDA_EXTENSION_NAME}] Processing data from request ${requestId}`
        );
        cumulativeLambdaMetrics.invocationCount += 1;
        cumulativeLambdaMetrics.totalMemoryDurationMsMB +=
          Number(billedDurationMs) * Number(memorySizeMB);
        return cumulativeLambdaMetrics;
      },
      { totalMemoryDurationMsMB: 0, invocationCount: 0 }
    );
  const budgets = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => key.startsWith(ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX))
      .map(([key, value]) => [
        key.slice(ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX.length + 1),
        Number(value),
      ])
  );
  console.log(
    `[telementry-listener:${LAMBDA_EXTENSION_NAME}] budgets: ${Object.entries(
      budgets
    )}`
  );
  const updatedBudgetAccruedExpenses = await updateAllBudgetAccruedExpenses(
    newInvocationsCumulativeLambdaMetrics,
    budgets
  );
  console.log(
    `[telementry-listener:${LAMBDA_EXTENSION_NAME}] Budgets have been updated in DynamoDB`
  );

  if (isExceedingAnyBudget(updatedBudgetAccruedExpenses, budgets)) {
    console.log(
      `[telementry-listener:${LAMBDA_EXTENSION_NAME}] Budget exceeded, disabling Lambda function by setting reserved concurrency to 0`
    );
    await disableLambda(functionName);
  }
};

const startTelemetryListener = async (
  functionName: string
): Promise<string> => {
  console.log(
    `[telementry-listener:${LAMBDA_EXTENSION_NAME}] Starting a listener`
  );
  const server = express();
  server.use(express.json({ limit: "512kb" }));

  server.post("/", async (req, res) => {
    // Respond immediatly to avoid HeadersTimeoutError
    res.send("OK");

    if (!req.body.length || req.body.length === 0) {
      return;
    }

    const telemetryEvents = req.body as TelemetryEvent[];
    console.log(
      `[telementry-listener:${LAMBDA_EXTENSION_NAME}] ${telemetryEvents.length} telemetry events received`
    );

    await processTelemetryEvents(functionName, telemetryEvents);
  });

  const listenerUrl = `http://${LISTENER_HOST}:${LISTENER_PORT}`;
  await new Promise((resolve) => {
    server.listen(LISTENER_PORT, LISTENER_HOST, () => {
      console.log(
        `[telementry-listener:${LAMBDA_EXTENSION_NAME}] listening at ${listenerUrl}`
      );
      resolve("Listening");
    });
  });
  return listenerUrl;
};

interface CumulativeLambdaMetrics {
  totalMemoryDurationMsMB: number;
  invocationCount: number;
}

const PER_INVOCATION_PRICE_REVANTIOS = 2000;
const PER_1024MB_PER_SECOND_PRICE_REVANTIOS = 16667;

const MS_IN_ONE_SECOND = 1000;
const updateAllBudgetAccruedExpenses = async (
  { totalMemoryDurationMsMB, invocationCount }: CumulativeLambdaMetrics,
  budgets: Record<string, number>
): Promise<Record<string, number>> => {
  const currentDate = new Date().toISOString();
  const addresses = Object.keys(budgets);
  const invocationAddedExpensesRevantios =
    invocationCount * PER_INVOCATION_PRICE_REVANTIOS;
  const durationAddedExpensesRevantios = Math.round(
    (totalMemoryDurationMsMB * PER_1024MB_PER_SECOND_PRICE_REVANTIOS) /
      (MS_IN_ONE_SECOND * 1024)
  );
  const addedExpensesRevantios =
    invocationAddedExpensesRevantios + durationAddedExpensesRevantios;
  // We could use TransctWriteItems instead of paralell updateItem calls, however transact does not return updated accrued expenses
  const updatedBudgetAccruedExpenses: Record<string, number> = {};
  await Promise.allSettled(
    addresses.map(async (address) => {
      const { Attributes } = await dynamoDBDocumentClient.send(
        new UpdateCommand({
          TableName: process.env[ENV_VARIABLE_REVANT_COST_TABLE_NAME],
          ReturnValues: "UPDATED_NEW",
          Key: {
            PK: [currentDate.slice(0, 7), address].join("#"),
          },
          UpdateExpression: `ADD #B :accruedExpenses SET #U = :updatedAt`,
          ExpressionAttributeNames: {
            "#B": DYNAMODB_ACCRUED_EXPENSES_ATTRIBUTE_NAME,
            "#U": DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME,
          },
          ExpressionAttributeValues: {
            ":accruedExpenses": addedExpensesRevantios,
            ":updatedAt": currentDate,
          },
        })
      );
      Object.assign(updatedBudgetAccruedExpenses, {
        [address]: Attributes?.[DYNAMODB_ACCRUED_EXPENSES_ATTRIBUTE_NAME],
      });
    })
  );
  return updatedBudgetAccruedExpenses;
};

const subscribeTelemetry = async (extensionId: string, listenerUri: string) => {
  console.log(`[telemetry-api:${LAMBDA_EXTENSION_NAME}] Subscribing`, {
    LAMBDA_TELEMETRY_API_BASE_URL,
    extensionId,
    listenerUri,
  });

  const subscriptionBody = {
    schemaVersion: "2022-07-01",
    destination: {
      protocol: "HTTP",
      URI: listenerUri,
    },
    types: ["platform"],
  };

  const res = await fetch(LAMBDA_TELEMETRY_API_BASE_URL, {
    method: "put",
    body: JSON.stringify(subscriptionBody),
    headers: {
      "Content-Type": "application/json",
      [LAMBDA_EXTENSION_API_ID_HEADER_NAME]: extensionId,
    },
  });

  switch (res.status) {
    case 200:
      console.log(
        `[telemetry-api:${LAMBDA_EXTENSION_NAME}] Subscription success:`,
        await res.text()
      );
      break;
    case 202:
      console.warn(
        `[telemetry-api:${LAMBDA_EXTENSION_NAME}] Telemetry API not supported. Are you running the extension locally`
      );
      break;
    default:
      console.error(
        `[telemetry-api:${LAMBDA_EXTENSION_NAME}] Subscription failure:`,
        await res.text()
      );
      break;
  }
};

const isExceedingAnyBudget = (
  updatedBudgetAccruedExpenses: Record<string, number>,
  budgets: Record<string, number>
) => {
  return Object.entries(budgets).some(
    ([address, budget]) => updatedBudgetAccruedExpenses[address] > budget
  );
};

const main = async () => {
  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  const { extensionId, functionName } = await registerExtension();
  const listenerUri = await startTelemetryListener(functionName);
  await subscribeTelemetry(extensionId, listenerUri);

  while (true) {
    const event = await next(extensionId);

    switch (event.eventType) {
      case "INVOKE":
        break;
      case "SHUTDOWN":
        const remainingTimeMs = event.deadlineMs - Date.now();
        // Awaiting for remaining telemetry event to be received by listener while keeping a margin
        const marginMs = 400;
        await new Promise((resolve) =>
          setTimeout(resolve, remainingTimeMs - marginMs)
        );
        handleShutdown(event.eventType);
    }
  }
};

main();
