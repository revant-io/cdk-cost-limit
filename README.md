<!-- HEADER -->
<br />
<div align="center">
  <a href="https://github.com/revant-io">
    <img src="images/logo.png" alt="Logo" width="80" height="80">
  </a>

  <h1 align="center">Cost Limit for AWS</h1>

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

## Overview

### What?

This package lets you set spending limits on AWS. Existing AWS cost-related services only send alerts: this library automatically disables resources, using non-destructive operations, when your budget is reached.

### Why?

Every month, lots of companies and individual contributors find their cloud bill skyrocketing due to a mistake in their application code, a misunderstanding of the costs associated with subscribed services, or even a malicious use of some unsecured resources. This library gives you the opportunity to protect your account from those unfortunate events.

> 📖 Want to read AWS billing horror stories? Have a look at this [amazing blog post by Victor Grenu](https://unusd.cloud/blog/post-5/)!

### How?

This library includes an [Aspect](https://docs.aws.amazon.com/cdk/v2/guide/aspects.html) and a collection of [AWS CDK Level-2 Constructs](https://docs.aws.amazon.com/cdk/v2/guide/constructs.html#constructs_lib). They deploy additional resources on your AWS account in order to:
- compute in real-time your current spending amounts
- update resources when they should not incur additional costs because budget has been reached (e.g. Lambda Functions reserved concurrency is set to 0 to prevent further invokes)

All additional resources provisioned by this library are detailed in the [catalog documentation](./docs/constructs.md#per-service-level-2-constructs).

### Tradeoffs

#### 🚧 Disabled resources are no longer available

In order to stick to your budget, over-spending resources are disabled. This means they are no longer usable within your application, resulting in partial and/or complete unavailability, depending on the affected resources scope.

#### 💰 Additional resources incur an additional cost

This library deploys additional resources, which incur additional costs. It is worth considering while setting your budget limit.

#### 🏎️ Additional resources impact performances negatively

Some of the resources provisioned by this library have a negative impact on your application performance (e.g. Lambda cold start times are a bit longer due to the addition of a Layer).


> 🧑‍💻 We're actively working on reducing cost and perf impacts of this library! We'll keep you posted as we minimize and eventually remove complitely those tradeoffs

## Getting started

### Prerequisites

CDK Cost Limit is built upon the AWS CDK, so you need to install Node.js (>= 14.15.0), even those working in languages other than TypeScript or JavaScript (see [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites)). 

### Installation

```sh
npm install -s @revant-io/cdk-cost-limit
```

## Supported services/resources

- ✅ `AWS::Lambda::Function`
- ⏳ `AWS::EC2::Instance`

## Constructs

You can find the complete list of supported services and exported constructs in the [catalog documentation](./docs/constructs.md)