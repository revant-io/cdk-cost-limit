import { Construct } from "constructs";
import {
  AttributeType,
  BillingMode,
  StreamViewType,
  Table,
} from "aws-cdk-lib/aws-dynamodb";
import { Stack } from "aws-cdk-lib";
import { LambdaCommonResources } from "./services/lambda";
import { EC2CommonResources } from "./services/ec2";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import {
  FilterCriteria,
  FilterRule,
  StartingPosition,
} from "aws-cdk-lib/aws-lambda";
import path from "path";
import { Revantios } from "./revantios";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";

const ENV_VARIABLE_REVANT_COST_TABLE_NAME = "REVANT_COST_TABLE_NAME";
const ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX = "REVANT_COST_LIMIT";
const ENV_VARIABLE_REVANT_SCHEDULE_ROLE_ARN = "REVANT_SCHEDULE_ROLE_ARN";
const ENV_VARIABLE_REVANT_SCHEDULE_FUNCTION_ARN =
  "REVANT_SCHEDULE_FUNCTION_ARN";
const DYNAMODB_INCURRED_EXPENSES_RATE_ATTRIBUTE_NAME = "incurredExpensesRate";

export class CoreRessources extends Construct {
  public dynamoDBTable: Table;

  private _lambdaCommonResources?: LambdaCommonResources;
  private _ec2CommonResources?: EC2CommonResources;

  private updateAccruedExpensesWithCurrentIncurredExpensesRate: NodejsFunction;

  static instance: CoreRessources;

  private constructor(scope: Construct) {
    super(scope, "RevantCore");

    this.dynamoDBTable = new Table(this, "CostTable", {
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
    });
    this.updateAccruedExpensesWithCurrentIncurredExpensesRate =
      new NodejsFunction(
        this,
        "UpdateAccruedExpensesWithCurrentIncurredExpensesRateFunction",
        {
          entry: path.join(
            __dirname,
            "./functions/updateAccruedExpensesWithCurrentIncurredExpensesRate.ts"
          ),
        }
      );
    this.dynamoDBTable.grant(
      this.updateAccruedExpensesWithCurrentIncurredExpensesRate,
      "dynamodb:UpdateItem"
    );
    this.updateAccruedExpensesWithCurrentIncurredExpensesRate.addEnvironment(
      ENV_VARIABLE_REVANT_COST_TABLE_NAME,
      this.dynamoDBTable.tableName
    );
    this.updateAccruedExpensesWithCurrentIncurredExpensesRate.addEventSource(
      new DynamoEventSource(this.dynamoDBTable, {
        startingPosition: StartingPosition.LATEST,
        reportBatchItemFailures: true,
        filters: [
          FilterCriteria.filter({
            eventName: FilterRule.isEqual("MODIFY"),
            dynamodb: {
              OldImage: {
                [DYNAMODB_INCURRED_EXPENSES_RATE_ATTRIBUTE_NAME]: {
                  N: FilterRule.exists(),
                },
              },
            },
          }),
        ],
      })
    );

    const scheduleRole = new Role(this, "ScheduleRole", {});
    scheduleRole.grantAssumeRole(
      new ServicePrincipal("scheduler.amazonaws.com")
    );

    this.updateAccruedExpensesWithCurrentIncurredExpensesRate.addEnvironment(
      ENV_VARIABLE_REVANT_SCHEDULE_ROLE_ARN,
      scheduleRole.roleArn
    );
    this.updateAccruedExpensesWithCurrentIncurredExpensesRate.addEnvironment(
      ENV_VARIABLE_REVANT_SCHEDULE_FUNCTION_ARN,
      "test-arn"
    );
  }

  public registerBudget = (address: string, budget: number) => {
    this.updateAccruedExpensesWithCurrentIncurredExpensesRate.addEnvironment(
      [ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX, address].join("_"),
      Revantios.fromCents(budget).toString()
    );
  };

  public get lambdaCommonResources() {
    if (this._lambdaCommonResources === undefined) {
      this._lambdaCommonResources = new LambdaCommonResources(this);
    }
    return this._lambdaCommonResources;
  }

  public get ec2CommonResources() {
    if (this._ec2CommonResources === undefined) {
      this._ec2CommonResources = new EC2CommonResources(this);
    }
    return this._ec2CommonResources;
  }

  public static getInstance(scope: Construct): CoreRessources {
    if (!CoreRessources.instance) {
      CoreRessources.instance = new CoreRessources(Stack.of(scope));
    }
    return CoreRessources.instance;
  }
}
