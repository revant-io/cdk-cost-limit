import { Aspects, IAspect } from "aws-cdk-lib";
import { IConstruct } from "constructs";
import { Function as CoreFunction } from "aws-cdk-lib/aws-lambda";
import { Instance as CoreInstance } from "aws-cdk-lib/aws-ec2";
import { Function } from "./services/lambda";
import { Instance } from "./services/ec2";

export type CostLimitProps = {
  /**
   * The budget allocated to this construct in $US cents.
   * For exemple, if you want to set a budget of $1,00 for a specific node, you
   * should used a value of 100 for this prop.
   *
   * @default undefined - Unlimited budget
   */
  readonly budget?: number;
};

export class CostLimit implements IAspect {
  private budget: number;
  private address: string;
  constructor({ budget }: Required<CostLimitProps>) {
    this.budget = budget;
  }
  public visit(node: IConstruct): void {
    const nodeWithCostLimitAspect = Aspects.of(node).all.find(
      (aspect) => aspect === this
    ) as this | undefined;
    if (nodeWithCostLimitAspect !== undefined) {
      this.address = node.node.addr;
    }

    if (node instanceof CoreFunction && !(node instanceof Function)) {
      Function.limitBudget(node, this.budget, this.address);
    }

    if (node instanceof CoreInstance && !(node instanceof Instance)) {
      Instance.limitBudget(node, this.budget, this.address);
    }
  }
}
