import {
  Instance as InstanceCore,
  InstanceProps as CoreInstanceProps,
} from "aws-cdk-lib/aws-ec2";
import { Rule, RuleTargetInput } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Effect, IRole, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct, IConstruct } from "constructs";

import { CostLimitProps } from "../cost-limit";
import { CoreRessources } from "../core-resources";
import { Revantios } from "../revantios";
import path from "path";

// Env variables names used internally - duplicated in extension code, should be deduplicated
const ENV_VARIABLE_REVANT_COST_TABLE_NAME = "REVANT_COST_TABLE_NAME";

export type InstanceProps = CostLimitProps & CoreInstanceProps;

class EC2InstanceChangeRule extends Rule {
  constructor(
    scope: Construct,
    id: string,
    {
      instance,
      states,
    }: {
      instance: InstanceCore;
      states: ("running" | "stopping" | "shutting-down")[];
    }
  ) {
    super(scope, id, {
      eventPattern: {
        source: ["aws.ec2"],
        detailType: ["EC2 Instance State-change Notification"],
        detail: {
          "instance-id": [instance.instanceId],
          /**
           * Only running state is billed.
           * Lifecycle guide: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html
           */
          state: states,
        },
      },
    });
  }
}

export class Instance extends InstanceCore {
  public static CoreConstruct = InstanceCore;
  public static limitBudget(
    instance: InstanceCore,
    budget: number,
    address: string
  ) {
    const onEC2Started = new EC2InstanceChangeRule(
      instance,
      "BillingStartedEC2NotificationRule",
      {
        instance,
        states: ["running"],
      }
    );
    onEC2Started.addTarget(
      new LambdaFunction(
        CoreRessources.getInstance(instance).ec2CommonResources.updateBudget,
        {
          event: RuleTargetInput.fromObject({
            instanceId: instance.instanceId,
            address,
            budget: Revantios.fromCents(budget).amount,
          }),
        }
      )
    );
    new EC2InstanceChangeRule(instance, "BillingEndedEC2NotificationRule", {
      instance,
      states: ["stopping", "shutting-down"],
    });
  }

  public static applyAspect(node: IConstruct, budget: number, address: string) {
    if (node instanceof this.CoreConstruct) {
      this.limitBudget(node, budget, address);
    }
  }

  constructor(
    scope: Construct,
    id: string,
    { budget, ...instanceProps }: InstanceProps
  ) {
    super(scope, id, instanceProps);

    if (budget === undefined) {
      // No budget restriction, early return
      return;
    }

    Instance.limitBudget(this, budget, this.node.addr);
  }
}

export class EC2CommonResources extends Construct {
  public updateBudget: NodejsFunction;
  constructor(coreResources: CoreRessources) {
    super(coreResources, "EC2Common");

    this.updateBudget = new NodejsFunction(this, "UpdateBudgetFunction", {
      entry: path.join(__dirname, "../functions/updateBudget.ts"),
    });
    this.updateBudget.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ec2:DescribeInstanceAttribute", "ec2:StopInstances"],
        resources: ["*"],
      })
    );
    this.updateBudget.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["pricing:GetProducts"],
        resources: ["*"],
      })
    );
    const { dynamoDBTable } = coreResources;
    dynamoDBTable.grant(this.updateBudget, "dynamodb:UpdateItem");

    this.updateBudget.addEnvironment(
      ENV_VARIABLE_REVANT_COST_TABLE_NAME,
      dynamoDBTable.tableName
    );
  }
}
