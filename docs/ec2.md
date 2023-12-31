# AWS Lambda

> [!NOTE]
> Max AWS EC2 instances spending rate with default AWS Quotas: $63 / hour / region

## Usage

Preferred implementation leverages [`CostLimit` aspect](./constructs.md#costlimit-aspect).

Alternatively, you can simply replace your `Instance` native CDK import statement by this package exported `Instance` construct.

```diff
- import { Instance } from "@aws-cdk-lib/aws-ec2";
+ import { Instance } from "@revant-io/cdk-cost-limit";
```

The `Instance` construct accepts the exact same props at the AWS CDK Instance construct (refer to the [AWS CDK dedicated documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Instance.html) for a list of all supported props). In addition to those native props, it accepts the following:

| Name    | Type   | Description                                                                 |
| ------- | ------ | --------------------------------------------------------------------------- |
| budget? | number | The monthly budget limit for this specific resource, specified in $US cents |

_Example_

```typescript
import { Instance } from "@revant-io/cdk-cost-limit";

const fn = new Instance(this, "MyInstance", {
  /* The budget allocated to this resource in $US cents.
   * For exemple, if you want to set a budget of $1,00
   * for a specific Lambda function, you should used
   * a value of 100 for this prop.
   */
  budget: 100,
});
```

By default, if budget is not specified, an unlimited budget (Instance normal behavior) is used.

## How it works

![EC2 architecture](../images/ec2.png)

### Disabling strategy

EC2 instances are disabled using the [StopInstances command](https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_StopInstances.html).
### What is deployed?

EC2 service nativelly broadcast status update event on AWS account default EventBridge Bus. 2 EventBridge Rules are provisionned to listen to instance-specific starting and stopping events. Those rules targets a generic lambda function in charge of fetching up-to-date catalog price for the instance, updating incurred expenses rate, and eventually stop the instance if budget is already exceeded. Budget informations (address and amout) are accessible by the lambda through parameters specified directly on the rule.

## Manually restore

In order to reset `Instance` that have been disabled by a budget, you need to start the instance.

```sh
aws ec2 start-instances --instance-ids <instanceId>
```
