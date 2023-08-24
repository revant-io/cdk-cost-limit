# Construct catalog

This library includes an [Aspect](https://docs.aws.amazon.com/cdk/v2/guide/aspects.html) and a collection of [AWS CDK Level-2 Constructs](https://docs.aws.amazon.com/cdk/v2/guide/constructs.html#constructs_lib) with hard-limit monthly budget capabilities.

## CostLimit Aspect

Using the exported `CostLimit` Aspect is the recommended way to enable cost-limit capabilities on your resources. If you'd however like not to use an Aspect, you can refer to the [per service documentation](#per-service-level-2-constructs)

You can use the Aspect on any node to enable budget limits. 

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

## How it works?

This library provision additional resources, splitted in 2 categories:
- common resources (like a DynamoDB table to store current spending amounts) that are used by all `CostLimit` Aspect usages
- dedicated resources, depending on the type of resource protected by a budget limit.

## Per-Service Level-2 Constructs

This collection of CDK constructs covers multiple AWS services and resource types.

[AWS Lambda](./lambda.md)