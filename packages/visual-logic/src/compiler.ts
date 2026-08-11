import { Condition, Effect } from "@grimoire3d/ir";
import { EventGraph, VisualLogicNode, CompiledEventScript } from "./types";

export class EventGraphCompiler {
  public static compile(graph: EventGraph): CompiledEventScript[] {
    const scripts: CompiledEventScript[] = [];
    const triggerNodes = graph.nodes.filter((n) => n.type === "trigger");

    for (const triggerNode of triggerNodes) {
      const errors: string[] = [];
      const conditions: Condition[] = [];
      const effects: Effect[] = [];

      // Find downstream nodes connected to this trigger node
      const connectedEdges = graph.edges.filter((e) => e.fromNodeId === triggerNode.id);
      const visited = new Set<string>([triggerNode.id]);

      const queue = [...connectedEdges];

      while (queue.length > 0) {
        const edge = queue.shift()!;
        const targetNode = graph.nodes.find((n) => n.id === edge.toNodeId);

        if (!targetNode) {
          errors.push(`Orphan edge '${edge.id}' target node '${edge.toNodeId}' not found.`);
          continue;
        }

        if (visited.has(targetNode.id)) {
          errors.push(`Cycle detected involving node '${targetNode.id}'.`);
          continue;
        }
        visited.add(targetNode.id);

        // Process Condition Nodes
        if (targetNode.type === "condition") {
          const cond = this.compileConditionNode(targetNode, errors);
          if (cond) conditions.push(cond);
        }

        // Process Action Effect Nodes
        if (targetNode.type === "action") {
          const eff = this.compileActionNode(targetNode, errors);
          if (eff) effects.push(eff);
        }

        // Enqueue next downstream edges
        const nextEdges = graph.edges.filter((e) => e.fromNodeId === targetNode.id);
        queue.push(...nextEdges);
      }

      scripts.push({
        graphId: graph.id,
        triggerNodeId: triggerNode.id,
        conditions,
        effects,
        valid: errors.length === 0,
        errors,
      });
    }

    return scripts;
  }

  private static compileConditionNode(node: VisualLogicNode, errors: string[]): Condition | null {
    switch (node.kind) {
      case "checkFlag": {
        if (!node.data.flag) {
          errors.push(`Condition node '${node.id}' missing required 'flag' parameter.`);
          return null;
        }
        return {
          kind: "flag",
          flag: node.data.flag,
          equals: node.data.equals ?? true,
        };
      }
      case "checkItem": {
        if (!node.data.itemId) {
          errors.push(`Condition node '${node.id}' missing required 'itemId' parameter.`);
          return null;
        }
        return {
          kind: "hasItem",
          itemId: node.data.itemId,
        };
      }
      default:
        return { kind: "always" };
    }
  }

  private static compileActionNode(node: VisualLogicNode, errors: string[]): Effect | null {
    switch (node.kind) {
      case "setFlag": {
        if (!node.data.flag) {
          errors.push(`Action node '${node.id}' missing required 'flag' parameter.`);
          return null;
        }
        return {
          kind: "setFlag",
          flag: node.data.flag,
          value: node.data.value ?? true,
        };
      }
      case "grantItem": {
        if (!node.data.itemId) {
          errors.push(`Action node '${node.id}' missing required 'itemId' parameter.`);
          return null;
        }
        return {
          kind: "grantItem",
          itemId: node.data.itemId,
        };
      }
      case "revealSecret": {
        if (!node.data.secretId) {
          errors.push(`Action node '${node.id}' missing required 'secretId' parameter.`);
          return null;
        }
        return {
          kind: "revealSecret",
          secretId: node.data.secretId,
        };
      }
      case "unlockExit": {
        if (!node.data.exitId) {
          errors.push(`Action node '${node.id}' missing required 'exitId' parameter.`);
          return null;
        }
        return {
          kind: "openExit",
          exitId: node.data.exitId,
        };
      }
      default:
        errors.push(`Action node '${node.id}' has unhandled kind '${node.kind}'.`);
        return null;
    }
  }
}
