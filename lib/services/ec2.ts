import {
  Instance as InstanceCore,
  InstanceProps as CoreInstanceProps,
} from "aws-cdk-lib/aws-ec2";
import { Rule } from "aws-cdk-lib/aws-events";
import { Construct, IConstruct } from "constructs";
import { CostLimitProps } from "../cost-limit";

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
    new EC2InstanceChangeRule(instance, "BillingStartedEC2NotificationRule", {
      instance,
      states: ["running"],
    });
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
