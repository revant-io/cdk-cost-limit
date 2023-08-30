import { Construct, IConstruct } from "constructs";
import { IRole } from "aws-cdk-lib/aws-iam";
import {
  Architecture,
  Function as CoreFunction,
  FunctionProps as CoreFunctionProps,
} from "aws-cdk-lib/aws-lambda";

import { CostLimitProps } from "../cost-limit";
import { CoreRessources } from "../core-resources";

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
    const { layerARM, layerX86, dynamoDBTable, policy } =
      CoreRessources.getInstance(lambdaFunction);
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
      budget.toString()
    );
    lambdaFunction.addEnvironment(
      ENV_VARIABLE_REVANT_COST_TABLE_NAME,
      dynamoDBTable.tableName
    );
    policy.attachToRole(lambdaFunction.role as IRole);
  }

  public static applyAspect(node: IConstruct, budget: number, address: string) {
    if (node instanceof this.CoreConstruct && !(node instanceof this)) {
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
