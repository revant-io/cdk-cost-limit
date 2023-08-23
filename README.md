<!-- HEADER -->
<br />
<div align="center">
  <a href="https://github.com/revant-io">
    <img src="images/logo.png" alt="Logo" width="80" height="80">
  </a>

  <h1 align="center">CDK Cost Limit</h1>

  <p align="center">
    A Collection of CDK Constructs to Deploy Cost-Aware Self-Limiting Resources
    <br />
    <br />
    <a href="">Website</a>
    ·
    <a href="">Docs</a>
    ·
    <a href="">Request Feature</a>
  </p>
</div>

## Getting started

### Prerequisites

CDK Cost Limit is built upon the AWS CDK, so you need to install Node.js (>= 14.15.0), even those working in languages other than TypeScript or JavaScript (see [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites)). 

### Installation

```sh
npm install -s @revant-io/cdk-cost-limit
```

## Constructs

### Per services

This collection of CDK constructs covers multiple AWS services and resource types.

[AWS Lambda](./docs/lambda.md)

### General Cost Limit Aspect

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
