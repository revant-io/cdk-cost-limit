# AWS Lambda

> [!NOTE]
> Max AWS Lambda spending rate: $1200 / hour / region

## Usage

Preferred implementation leverages [`CostLimit` aspect](./constructs.md#costlimit-aspect).

Alternatively, you can simply replace your `Function` native CDK import statement by this package exported `Function` construct.

```diff
- import { Function } from "@aws-cdk-lib/aws-lambda";
+ import { Function } from "@revant-io/cdk-cost-limit";
```

The `Function` construct accepts the exact same props at the AWS CDK Function construct (refer to the [AWS CDK dedicated documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda.Function.html) for a list of all supported props). In addition to those native props, it accepts the following:

| Name    | Type   | Description                                                                 |
| ------- | ------ | --------------------------------------------------------------------------- |
| budget? | number | The monthly budget limit for this specific resource, specified in $US cents |

_Example_

```typescript
import { Function } from "@revant-io/cdk-cost-limit";

const fn = new Function(this, "MyFunction", {
  /* The budget allocated to this resource in $US cents.
   * For exemple, if you want to set a budget of $1,00
   * for a specific Lambda function, you should used
   * a value of 100 for this prop.
   */
  budget: 100,
});
```

By default, if budget is not specified, an unlimited budget (Function normal behavior) is used.

## How it works

![Lambda architecture](../images/lambda.png)


### Disabling strategy

Lambda functions are disabled using the [reserved concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html) parameter. The value for this parameter is set to 0 when a specific function is disabled.
### What is deployed?

Budget update and control is handled by an extension packaged in 2 layers (one for x86 architecture and one for ARM architecture). This extension starts a local endpoint and register for telemetry events from Lambda service. It listen to `platform.report` events, containing billed duration and memory configuration informations. Budget informations (address and amout) are accessible by the extension using environment variables.

## Manually restore

In order to reset `Function` that have been disabled by a budget, you need to remove the reserved concurrency.

```sh
aws lambda delete-function-concurrency --function-name <functionName>
```

If your function already had a reserved concurrency as specified in your CDK code base like so

```typescript
new Function(scope, "MyFunction", {
  //...
  reservedConcurrentExecutions: 23, // your initial reserved concurrency
  //...
});
```

you can reset it back to the initial value using the corresponding `update-function-concurrency` API

```sh
aws lambda put-function-concurrency --function-name <functionName> --reserved-concurrent-executions <initialReservedConcurrencyValue>
```
