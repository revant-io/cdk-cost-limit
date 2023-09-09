import { App, Duration, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ExpectedResult, IntegTest, Match } from "@aws-cdk/integ-tests-alpha";

import {
  Instance as CoreInstance,
  InstanceClass,
  InstanceSize,
  InstanceType,
  MachineImage,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import { BaseStackUnderTest } from "./test-utils";

const app = new App();

class EC2Stack extends BaseStackUnderTest {
  public instanceId: string;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, "VPC");
    const instance = new CoreInstance(this, "EC2Instance", {
      vpc,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: MachineImage.latestAmazonLinux2023(),
    });

    this.instanceId = instance.instanceId;
  }
}

const stackUnderTest = new EC2Stack(app, "EC2StackUnderTest");
const integ = new IntegTest(app, "EC2Integ", {
  testCases: [stackUnderTest],
});

integ.assertions
  .awsApiCall("EC2", "stopInstances", {
    InstanceIds: [stackUnderTest.instanceId],
  })
  .next(
    integ.assertions
      .awsApiCall("EC2", "describeInstanceStatus", {
        InstanceIds: [stackUnderTest.instanceId],
        IncludeAllInstances: true,
        // Just a trick to allow multiple call to the same action - see https://github.com/aws/aws-cdk/pull/25241
        Filters: [
          {
            Name: "instance-state-name",
            Values: [
              "pending",
              "running",
              "shutting-down",
              "terminated",
              "stopping",
              "stopped",
            ],
          },
        ],
      })
      .expect(
        ExpectedResult.objectLike({
          InstanceStatuses: Match.arrayWith([
            Match.objectLike({
              InstanceState: {
                Name: "stopped",
              },
            }),
          ]),
        })
      )
      .waitForAssertions({
        totalTimeout: Duration.minutes(3),
        interval: Duration.seconds(15),
      })
  )
  .next(
    integ.assertions.awsApiCall("DynamoDB", "putItem", {
      TableName: stackUnderTest.dynamoDBTableName,
      Item: {
        PK: { S: stackUnderTest.dynamoDBBudgetIndex },
        accruedExpenses: {
          // Testing case where budget is already exceeded
          N: (stackUnderTest.budget.amount + 1).toString(),
        },
        updatedAt: {
          S: new Date().toISOString(),
        },
      },
    })
  )
  .next(
    integ.assertions.awsApiCall("EC2", "startInstances", {
      InstanceIds: [stackUnderTest.instanceId],
    })
  )
  .next(
    integ.assertions
      .awsApiCall("EC2", "describeInstanceStatus", {
        InstanceIds: [stackUnderTest.instanceId],
        IncludeAllInstances: true,
      })
      .expect(
        ExpectedResult.objectLike({
          InstanceStatuses: Match.arrayWith([
            Match.objectLike({
              InstanceState: {
                Name: Match.stringLikeRegexp("(stopping|stopped)"),
              },
            }),
          ]),
        })
      )
      .waitForAssertions({
        totalTimeout: Duration.minutes(2),
        interval: Duration.seconds(3),
      })
  );
