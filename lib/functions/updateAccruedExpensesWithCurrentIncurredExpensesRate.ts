import { DynamoDBStreamHandler } from "aws-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { AttributeValue, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  SchedulerClient,
  CreateScheduleCommand,
} from "@aws-sdk/client-scheduler";

const ENV_VARIABLE_REVANT_COST_TABLE_NAME = "REVANT_COST_TABLE_NAME";
const ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX = "REVANT_COST_LIMIT";
const ENV_VARIABLE_REVANT_SCHEDULE_ROLE_ARN = "REVANT_SCHEDULE_ROLE_ARN";
const ENV_VARIABLE_REVANT_SCHEDULE_FUNCTION_ARN = "REVANT_SCHEDULE_FUNCTION_ARN";

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
const schedulerClient = new SchedulerClient({});

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
  Math.round(
    (new Date(newBudget[DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME]).getTime() -
      new Date(oldBudget[DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME]).getTime()) /
      1000
  ) * oldBudget[DYNAMODB_INCURRED_EXPENSES_RATE_ATTRIBUTE_NAME];

const calculateBudgetReachedEstimatedDate = ({
  accruedExpenses,
  incurredExpensesRate,
  updatedAt,
  budget,
}: {
  accruedExpenses: number;
  incurredExpensesRate: number;
  updatedAt: Date;
  budget: number;
}): Date => {
  const budgetReachedDate = new Date(updatedAt);
  budgetReachedDate.setSeconds(
    budgetReachedDate.getSeconds() +
      (budget - accruedExpenses) / incurredExpensesRate
  );
  return budgetReachedDate;
};

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

  const budgets = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => key.startsWith(ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX))
      .map(([key, value]) => [
        key.slice(ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX.length + 1),
        Number(value),
      ])
  );

  const failedUpdateIds: { itemIdentifier: string }[] = [];
  await Promise.all(
    budgetUpdatesOperations.map(
      async ({ itemIdentifier, oldBudget, newBudget }) => {
        try {
          const { Attributes } = await dynamoDBDocumentClient.send(
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
              ReturnValues: "ALL_NEW",
            })
          );
          if (Attributes === undefined) {
            console.error("Did not get any updated budget from DynamDB");
            return;
          }

          const address = oldBudget.PK.split("#")[1];
          const budget = budgets[address];
          const budgetReachedDate = calculateBudgetReachedEstimatedDate({
            accruedExpenses: Attributes[
              DYNAMODB_ACCRUED_EXPENSES_ATTRIBUTE_NAME
            ] as number,
            incurredExpensesRate: Attributes[
              DYNAMODB_INCURRED_EXPENSES_RATE_ATTRIBUTE_NAME
            ] as number,
            updatedAt: new Date(
              Attributes[DYNAMODB_LAST_UPDATE_ATTRIBUTE_NAME]
            ),
            budget,
          });
          await schedulerClient.send(new CreateScheduleCommand({
            Name: address,
            ScheduleExpression: `at(${budgetReachedDate.toISOString().split('.')[0]})`,
            Target: {
              RoleArn: process.env[ENV_VARIABLE_REVANT_SCHEDULE_ROLE_ARN],
              Arn: process.env[ENV_VARIABLE_REVANT_SCHEDULE_FUNCTION_ARN],
            },
            FlexibleTimeWindow: {
              Mode: "OFF"
            }
          }));
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
