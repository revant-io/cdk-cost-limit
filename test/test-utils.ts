import { Construct, IConstruct } from "constructs";
import {
  Aspects,
  CfnResource,
  IAspect,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";

import { CostLimit } from "../lib";
import { CoreRessources } from "../lib/core-resources";
import { Revantios } from "../lib/revantios";

class UseDestroyRemovalPolicy implements IAspect {
  visit(node: IConstruct): void {
    if (CfnResource.isCfnResource(node)) {
      node.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }
  }
}

export class BaseStackUnderTest extends Stack {
  public budget = Revantios.fromUSD(1);
  public dynamoDBBudgetIndex = [
    new Date().toISOString().slice(0, 7),
    this.node.addr,
  ].join("#");
  public dynamoDBTableName =
    CoreRessources.getInstance(this).dynamoDBTable.tableName;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    Aspects.of(this).add(new CostLimit({ budget: this.budget.toCents() }));
    Aspects.of(this).add(new UseDestroyRemovalPolicy());
  }
}
