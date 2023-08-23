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

## Supported services/resources

- ✅ `AWS::Lambda::Function`
- ⏳ `AWS::EC2::Instance`

## Constructs

You can find the complete list of supported services and exported constructs in the [catalog documentation](./docs/constructs.md)

## Why such construct library ?

Every month, lots of companies and individual contributors find their cloud bill skyrocketing due to a mistake in their application code, a cybersecurity breach, or a misunderstanding of the costs associated with subscribed services. This can compromise your financial stability and even lead to the demise of your business.

To prevent this, Revant aims at setting hard-limit budgets on your cloud services. This is especially useful for development environments, as the bill is somehow more important than the application's availability.