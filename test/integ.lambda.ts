import { App, Duration, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Architecture,
  InlineCode,
  Runtime,
  Function as CoreFunction,
} from "aws-cdk-lib/aws-lambda";
import {
  ExpectedResult,
  IntegTest,
  InvocationType,
} from "@aws-cdk/integ-tests-alpha";

import { BaseStackUnderTest } from "./test-utils";

const app = new App();

class LambdaStack extends BaseStackUnderTest {
  public functionName: string;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const nodejsFunction = new CoreFunction(this, "Handler", {
      architecture: Architecture.X86_64,
      code: InlineCode.fromInline(
        `exports.handler = (event, context, callback) => { setTimeout(() => callback("Throwing an error to have multiple execution triggered"), 1000) }`
      ),
      memorySize: 1024,
      runtime: Runtime.NODEJS_18_X,
      handler: "index.handler",
    });
    this.functionName = nodejsFunction.functionName;
  }
}

const stackUnderTest = new LambdaStack(app, "LambdaStackUnderTest");
const integ = new IntegTest(app, "LambdaFunctionInteg", {
  testCases: [stackUnderTest],
});

integ.assertions
  .awsApiCall("DynamoDB", "putItem", {
    TableName: stackUnderTest.dynamoDBTableName,
    Item: {
      PK: { S: stackUnderTest.dynamoDBBudgetIndex },
      accruedExpenses: {
        N: (stackUnderTest.budget.amount - 1).toString(),
      },
      updatedAt: {
        S: new Date().toISOString(),
      },
    },
  })
  .next(
    integ.assertions.invokeFunction({
      functionName: stackUnderTest.functionName,
      invocationType: InvocationType.EVENT,
    })
  )
  .next(
    integ.assertions
      .awsApiCall("Lambda", "getFunction", {
        FunctionName: stackUnderTest.functionName,
      })
      .expect(
        ExpectedResult.objectLike({
          Concurrency: {
            ReservedConcurrentExecutions: 0,
          },
        })
      )
      .waitForAssertions({
        totalTimeout: Duration.minutes(2),
        interval: Duration.seconds(3),
      })
  );
