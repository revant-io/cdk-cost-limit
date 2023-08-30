import { Instance as InstanceCore } from "aws-cdk-lib/aws-ec2";
import { Rule } from "aws-cdk-lib/aws-events";
import { Construct } from "constructs";

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
  public static limitBudget(
    instanceConstruct: InstanceCore,
    budget: number,
    address: string
  ) {
    new EC2InstanceChangeRule(
      instanceConstruct,
      "BillingStartedEC2NotificationRule",
      { instance: instanceConstruct, states: ["running"] }
    );
    new EC2InstanceChangeRule(
      instanceConstruct,
      "BillingEndedEC2NotificationRule",
      { instance: instanceConstruct, states: ["stopping", "shutting-down"] }
    );
  }
}
