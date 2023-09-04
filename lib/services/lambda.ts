import { Construct, IConstruct } from "constructs";
import { Effect, IRole, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  Architecture,
  Code,
  Function as CoreFunction,
  FunctionProps as CoreFunctionProps,
  LayerVersion,
} from "aws-cdk-lib/aws-lambda";

import { CostLimitProps } from "../cost-limit";
import { CoreRessources } from "../core-resources";
import path from "path";
import { Revantios } from "../revantios";

export type FunctionProps = CostLimitProps & CoreFunctionProps;

// Env variables names used internally - duplicated in extension code, should be deduplicated
const ENV_VARIABLE_REVANT_COST_TABLE_NAME = "REVANT_COST_TABLE_NAME";
const ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX = "REVANT_COST_LIMIT";

export class Function extends CoreFunction {
  public static CoreConstruct = CoreFunction;
  public static limitBudget(
    lambdaFunction: CoreFunction,
    budget: number,
    address: string
  ) {
    const {
      dynamoDBTable,
      lambdaCommonResources: { layerARM, layerX86, policy },
    } = CoreRessources.getInstance(lambdaFunction);
    dynamoDBTable.grant(lambdaFunction, "dynamodb:UpdateItem");

    if (
      lambdaFunction.architecture === Architecture.ARM_64 &&
      !lambdaFunction._layers.includes(layerARM)
    ) {
      lambdaFunction.addLayers(layerARM);
    }

    if (
      lambdaFunction.architecture === Architecture.X86_64 &&
      !lambdaFunction._layers.includes(layerX86)
    ) {
      lambdaFunction.addLayers(layerX86);
    }

    lambdaFunction.addEnvironment(
      [ENV_VARIABLE_REVANT_COST_LIMIT_PREFIX, address].join("_"),
      Revantios.fromCents(budget).toString()
    );
    lambdaFunction.addEnvironment(
      ENV_VARIABLE_REVANT_COST_TABLE_NAME,
      dynamoDBTable.tableName
    );
    policy.attachToRole(lambdaFunction.role as IRole);
  }

  public static applyAspect(node: IConstruct, budget: number, address: string) {
    if (node instanceof this.CoreConstruct) {
      this.limitBudget(node, budget, address);
    }
  }

  constructor(
    scope: Construct,
    id: string,
    { budget, ...functionProps }: FunctionProps
  ) {
    super(scope, id, functionProps);

    if (budget === undefined) {
      // No budget restriction, early return
      return;
    }

    Function.limitBudget(this, budget, this.node.addr);
  }
}

export class LambdaCommonResources extends Construct {
  public layerX86: LayerVersion;
  public layerARM: LayerVersion;
  public policy: Policy;
  constructor(scope: CoreRessources) {
    super(scope, "LambdaCommon");
    this.layerX86 = new LayerVersion(this, "X86ExtensionLayer", {
      code: Code.fromAsset(path.join(__dirname, "../layerX86")),
      compatibleArchitectures: [Architecture.X86_64],
    });

    this.layerARM = new LayerVersion(this, "ARMExtensionLayer", {
      code: Code.fromAsset(path.join(__dirname, "../layerARM")),
      compatibleArchitectures: [Architecture.X86_64],
    });

    const policyStatement = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["lambda:PutFunctionConcurrency"],
      resources: ["*"],
      // Not sure the following condition is working, to be checked later using https://docs.aws.amazon.com/lambda/latest/dg/lambda-api-permissions-ref.html#permissions-resources-function
      // conditions: {
      //   "ArnEquals": {
      //       "lambda:FunctionArn": ["${aws:SourceArn}"]
      //   }
      // }
    });
    this.policy = new Policy(this, "SelfDisablePolicy", {
      statements: [policyStatement],
    });
  }
}
