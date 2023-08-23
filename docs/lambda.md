# AWS Lambda

## Usage

You can simply replace your `Function` native CDK import statement by this package exported `Function` construct.


```diff
- import { Function } from "@aws-cdk-lib/aws-lambda";
+ import { Function } from "@revant-io/cdk-cost-limit";
```

The `Function` construct accepts the exact same props at the AWS CDK Function construct (refer to the [AWS CDK dedicated documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda.Function.html) for a list of all supported props). In addition to those native props, it accepts the following:

| Name    | Type   | Description                                                                 |
|---------|--------|-----------------------------------------------------------------------------|
| budget? | number | The monthly budget limit for this specific resource, specified in $US cents |

_Example_

```ts
import { Function } from "@revant-io/cdk-cost-limit

const fn = new Function(this, 'MyFunction', {
  /* The budget allocated to this resource in $US cents.
   * For exemple, if you want to set a budget of $1,00
   * for a specific Lambda function, you should used
   * a value of 100 for this prop.
   */
  budget: 100
});
```

By default, if budget is not specified, an unlimited budget (Function normal behavior) is used.

## How it works

Todo