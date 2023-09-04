import { DynamoDBStreamHandler } from "aws-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { AttributeValue, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ENV_VARIABLE_REVANT_COST_TABLE_NAME = "REVANT_COST_TABLE_NAME";

const DYNAMODB_ACCRUED_EXPENSES_ATTRIBUTE_NAME = "accruedExpenses";
const DYNAMODB_INCURRED_EXPENSES_RATE_ATTRIBUTE_NAME = "incurredExpensesRate";
const DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME = "updatedAt";

type Budget = {
  PK: string;
  [DYNAMODB_ACCRUED_EXPENSES_ATTRIBUTE_NAME]: number;
  [DYNAMODB_INCURRED_EXPENSES_RATE_ATTRIBUTE_NAME]: number;
  [DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME]: string;
};

type BudgetUpdateOperation = {
  oldBudget: Budget;
  newBudget: Budget;
};

const dynamoDBClient = new DynamoDBClient({});
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient);

const isBudgetUpdateOperation = ({
  oldBudget,
  newBudget,
}: BudgetUpdateOperation): boolean =>
  oldBudget[DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME] !==
  newBudget[DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME];

const calculateNewAccruedExpenses = ({
  oldBudget,
  newBudget,
}: BudgetUpdateOperation): number =>
  (new Date(newBudget[DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME]).getTime() -
    new Date(oldBudget[DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME]).getTime()) *
  oldBudget[DYNAMODB_INCURRED_EXPENSES_RATE_ATTRIBUTE_NAME];

export const handler: DynamoDBStreamHandler = async ({ Records }) => {
  console.log(`${Records.length} records received`);
  const budgetUpdatesOperations = Records.map((record) => ({
    itemIdentifier: record.eventID as string,
    oldBudget: unmarshall(
      record.dynamodb?.OldImage as Record<string, AttributeValue>
    ) as Budget,
    newBudget: unmarshall(
      record.dynamodb?.NewImage as Record<string, AttributeValue>
    ) as Budget,
  })).filter(isBudgetUpdateOperation);
  console.log(
    `${budgetUpdatesOperations.length} budget update operations received`
  );

  const failedUpdateIds: { itemIdentifier: string }[] = [];
  await Promise.all(
    budgetUpdatesOperations.map(
      async ({ itemIdentifier, oldBudget, newBudget }) => {
        try {
          await dynamoDBDocumentClient.send(
            new UpdateCommand({
              TableName: process.env[ENV_VARIABLE_REVANT_COST_TABLE_NAME],
              Key: { PK: oldBudget.PK },
              UpdateExpression: `ADD #A :accruedExpenses`,
              ExpressionAttributeNames: {
                "#A": DYNAMODB_ACCRUED_EXPENSES_ATTRIBUTE_NAME,
              },
              ExpressionAttributeValues: {
                ":accruedExpenses": calculateNewAccruedExpenses({
                  oldBudget,
                  newBudget,
                }),
              },
            })
          );
        } catch (error) {
          failedUpdateIds.push({ itemIdentifier });
        }
      }
    )
  );

  console.log(`${failedUpdateIds.length} updates failed: ${failedUpdateIds}`);
  return {
    batchItemFailures: failedUpdateIds,
  };
};
