import { Aspects, IAspect } from "aws-cdk-lib";
import { IConstruct } from "constructs";
import { Function as CoreFunction } from "aws-cdk-lib/aws-lambda";
import { Function } from "./services/lambda";

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
  private path: string;
  constructor({ budget }: Required<CostLimitProps>) {
    this.budget = budget;
  }
  public visit(node: IConstruct): void {
    const nodeWithCostLimitAspect = Aspects.of(node).all.find(aspect => aspect === this) as this | undefined;
    if (nodeWithCostLimitAspect !== undefined) {
      this.path = node.node.path;
    }

    if (node instanceof CoreFunction) {
      Function.limitBudget(node, this.budget, this.path);
    }
  }
}
