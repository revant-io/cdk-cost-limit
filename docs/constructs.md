# Construct catalog

Intro todo

## CostLimit Aspect

Using the exported `CostLimit` Aspect is the recommended way to enable cost-limit capabilities on your resources. If you'd however like not to use an Aspect, you can refer to the [per service documentation](#per-service)

If you'd like to use a more generic budget declaration for your resources, you can use the `CostLimit` [Aspect](https://docs.aws.amazon.com/cdk/v2/guide/aspects.html).

```ts
import { Aspects } from 'aws-cdk-lib';
import { CostLimit } from "@revant-io/cdk-cost-limit";

declare const fn: lambda.Function;
declare const instance: ec2.Instance;

// Set a monthly budget of $1,00 for this specific Lambda function `fn`
Aspects.of(fn).add(new CostLimit({ budget: 100 }));

// Set a monthly budget of $20,00 for this specific EC2 instance `instance`
Aspects.of(instance).add(new CostLimit({ budget: 2000 }));
```

You can use this Aspect to set the same monthly budget limit on all supported resources of your stack.

```ts
import { Aspects } from 'aws-cdk-lib';
import { CostLimit } from "@revant-io/cdk-cost-limit";

declare const stack: cdk.Stack;

// Set a monthly budget of $1,00 for each supported resources within `stack`
Aspects.of(stack).add(new CostLimit({ budget: 100 }));
```

## Per service constructs

This collection of CDK constructs covers multiple AWS services and resource types.

[AWS Lambda](./lambda.md)