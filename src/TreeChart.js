import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { get, uniqBy } from 'lodash'

interface IProps {
  data?: number[];
}

/* Component */
const TreeChart = (props: IProps) => {
  /* The useRef Hook creates a variable that "holds on" to a value across rendering
       passes. In this case it will hold our component's SVG DOM element. It's
       initialized null and React will assign it later (see the return statement) */
  const dy = 238.5;
  const dx = 30;
  const margin = { top: 10, right: 50, bottom: 10, left: 50 };
  const d3Container = useRef(null);

  const [data, setData] = useState({
    name: "P1",
    apiUrl: "https://api.github.com/users",
    children: []
  });

  const fetchData = async apiUrl => {
    try {
      const response = await fetch(apiUrl);
      const data1 = await response.json();

      data.children = uniqBy([
        ...data.children,
        ...data1.map(i => {
          return {
            name: i.login,
            children: []
          };
        })
      ], 'name');
      setData({...data})
    } catch (err) {
      console.log(err);
    }
  };
  const tree = d3.tree().nodeSize([dx, dy]);
  const diagonal = d3
    .linkHorizontal()
    .x(d => d.y)
    .y(d => d.x);
  /* The useEffect Hook is for running side effects outside of React,
       for instance inserting elements into the DOM using D3 */
    const root = d3.hierarchy(data);

    root.x0 = dy / 2;
    root.y0 = 0;
    root.descendants().forEach((d, i) => {
        d.id = i;
        d._children = d.children;
        if (d.depth && d.data.name.length !== 15) d.children = null;
    });
  useEffect(() => {
    // if (props.data && d3Container.current) {

    const svg = d3.select(d3Container.current);

    svg
      .append("svg:defs")
      .selectAll("marker")
      .data(["end"]) // Different link/path types can be defined here
      .enter()
      .append("svg:marker") // This section adds in the arrows
      .attr("id", String)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("marker1000", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("svg:path")
      .attr("d", "M0,-5L10,0L0,5");

    svg
      .attr("viewBox", [-margin.left, -margin.top, 1000, dx])
      .style("font", "10px sans-serif")
      .style("user-select", "none");

    const gLink = svg
      .append("g")
      .attr("fill", "none")
      .attr("stroke", "#212121")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5);

    const gNode = svg
      .append("g")
      .attr("cursor", "pointer")
      .attr("pointer-events", "all");

  

    update(svg, root, gNode, gLink);
    // }
  }, [data]);

  const update = (svg, source, gNode, gLink) => {
    const duration = d3.event && d3.event.altKey ? 2500 : 250;
    const nodes = root.descendants().reverse();
    const links = root.links();

    // Compute the new tree layout.
    tree(root);

    let left = root;
    let right = root;
    root.eachBefore(node => {
      if (node.x < left.x) left = node;
      if (node.x > right.x) right = node;
    });

    const height = right.x - left.x + margin.top + margin.bottom;

    const transition = svg
      .transition()
      .duration(duration)
      .attr("viewBox", [-margin.left, left.x - margin.top, 1000, height])
      .tween(
        "resize",
        window.ResizeObserver ? null : () => () => svg.dispatch("toggle")
      );

    // Update the nodes…
    const node = gNode.selectAll("g").data(nodes, d => d.id);

    // Enter any new nodes at the parent's previous position.
    const nodeEnter = node
      .enter()
      .append("g")
      .attr("transform", d => `translate(${source.y0},${source.x0})`)
      .attr("fill-opacity", 0)
      .attr("stroke-opacity", 0)
      .on("click", d => {
        // d.children = d.children ? null : d._children;
        if(get(d, 'children')) {
            d.children = null
            update(svg, d, gNode, gLink);
        } else {
            d.children = d._children;
            fetchData(get(d, 'data.apiUrl'));
            // update(svg, d, gNode, gLink);
        }
      });

    nodeEnter
      .append("circle")
      .attr("r", 6)
      .attr("fill", d => (d._children ? "#40c9c4" : "#555"))
      .attr("stroke-width", 10);

    nodeEnter
      .append("text")
      .attr("dy", "1em")
      .attr("x", d => (d._children ? -6 : 6))
      .attr("text-anchor", d => (d._children ? "end" : "start"))
      .text(d => d.data.name)
    //   .clone(true)
    //   .lower()
    //   .attr("stroke-linejoin", "round")
    //   .attr("stroke-width", 3)
    //   .attr("stroke", "white");

    // Transition nodes to their new position.
    const nodeUpdate = node
      .merge(nodeEnter)
      .transition(transition)
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .attr("fill-opacity", 1)
      .attr("stroke-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    const nodeExit = node
      .exit()
      .transition(transition)
      .remove()
      .attr("transform", d => `translate(${source.y},${source.x})`)
      .attr("fill-opacity", 0)
      .attr("stroke-opacity", 0);

    // Update the links…
    const link = gLink.selectAll("path").data(links, d => d.target.id);

    // Enter any new links at the parent's previous position.
    const linkEnter = link
      .enter()
      .append("path")
      .attr("d", d => {
        const o = { x: source.x0, y: source.y0 };
        return diagonal({ source: o, target: o });
      });

    // Transition links to their new position.
    link
      .merge(linkEnter)
      .transition(transition)
      .attr("d", diagonal)
      .attr("marker-end", "url(#end)");

    // Transition exiting nodes to the parent's snew position.
    link
      .exit()
      .transition(transition)
      .remove()
      .attr("d", d => {
        const o = { x: source.x, y: source.y };
        return diagonal({ source: o, target: o });
      });

    // Stash the old positions for transition.
    root.eachBefore(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }
  return (
    <svg className="d3-component" width={1000} height={500} ref={d3Container} />
  );
};

export default TreeChart;
