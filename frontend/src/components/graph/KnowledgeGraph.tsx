import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface GraphNode {
  id: string;
  label: string;
  type: string;
}

interface GraphLink {
  source: string;
  target: string;
  label?: string;
}

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  width?: number;
  height?: number;
}

const NODE_COLORS: Record<string, string> = {
  person: "#6C3FC5",    // violet
  org: "#F59E0B",       // oasis
  event: "#EF4444",     // red
  concept: "#00C4B4",   // concordia
  location: "#3B82F6",  // blue
};

function getNodeColor(type: string): string {
  return NODE_COLORS[type] ?? "#6B7280";
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  label?: string;
}

export function KnowledgeGraph({ nodes, links, width = 800, height = 600 }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = links.map((l) => ({ ...l }));

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Force simulation
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force("link", d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Links
    const link = g.append("g")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "#D1D5DB")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6);

    // Nodes
    const node = g.append("g")
      .selectAll("circle")
      .data(simNodes)
      .join("circle")
      .attr("r", 8)
      .attr("fill", (d) => getNodeColor(d.type))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "grab");

    // Labels
    const label = g.append("g")
      .selectAll("text")
      .data(simNodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", 10)
      .attr("dx", 12)
      .attr("dy", 4)
      .attr("fill", "#374151");

    // Drag behavior
    const drag = d3.drag<SVGCircleElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node.call(drag as any);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!);

      node
        .attr("cx", (d) => d.x!)
        .attr("cy", (d) => d.y!);

      label
        .attr("x", (d) => d.x!)
        .attr("y", (d) => d.y!);
    });

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
    };
  }, [nodes, links, width, height]);

  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400 text-sm">
        No graph data. Upload a document and build the graph first.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full"
        viewBox={`0 0 ${width} ${height}`}
      />
    </div>
  );
}
