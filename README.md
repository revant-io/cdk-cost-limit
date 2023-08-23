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

This package lets you set spending limits on AWS. While existing AWS solutions merely alert, this library disables resources, using non-destructive operations, when budgets are hit.

### Why?

Every month, companies and individual contributors face surging cloud bills due to mistakes in their application code, misunderstandings of services pricing model, or even malicious activities. This library shields you from such events.

> 📖 Have a look at those [AWS billing horror stories aggregated by Victor Grenu](https://unusd.cloud/blog/post-5/)!

### How?

This library includes an [Aspect](https://docs.aws.amazon.com/cdk/v2/guide/aspects.html) and a collection of [AWS CDK Level-2 Constructs](https://docs.aws.amazon.com/cdk/v2/guide/constructs.html#constructs_lib). They deploy [additional resources](./docs/constructs.md#per-service-level-2-constructs) to compute real-time spending and halt resources when budgets are met (e.g. Lambda Functions reserved concurrency is set to 0)

### Tradeoffs

- **🚧 Availability** - Disabled resources impacts your application availability
- **💰 Costs** - Tracking spending and halting resources incur additional costs
- **🏎️ Performance** - Some implementations negatively impact performances under normal conditions

> 🧑‍💻 We're actively working on reducing cost and perf impacts of this library! We'll [keep you posted](./docs/tradeoffs.md) as we minimize and eventually remove complitely those tradeoffs

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