// flaregraph.js
import { Path, BezierCurveFactory } from "../components/pathUtils.js";

(async () => {
  const raw = await d3.json("data/data.json");

  const vetSkills = (vet) =>
    raw.links
      .filter((l) => l.source === vet.id && l.target.startsWith("js-"))
      .map((l) => l.target);

  const jobSkills = (job) =>
    raw.links
      .filter((l) => l.source === job.id && l.target.startsWith("js-"))
      .map((l) => l.target);

  raw.nodes
    .filter((n) => n.type === "veteran")
    .forEach((vet) => {
      raw.nodes
        .filter((n) => n.type === "job")
        .forEach((job) => {
          if (vetSkills(vet).some((skill) => jobSkills(job).includes(skill))) {
            raw.links.push({ source: vet.id, target: job.id });
          }
        });
    });

  function buildFlareData(raw) {
    const root = { name: "root", children: [] },
      groups = new Map();

    raw.nodes.forEach((n) => {
      if (!groups.has(n.type)) {
        const g = { name: n.type, children: [] };
        groups.set(n.type, g);
        root.children.push(g);
      }
      groups.get(n.type).children.push({
        name: n.name,
        type: n.type,
        imageUrl: n.imageUrl,
        origId: n.id,
        imports: []
      });
    });

    const leafById = new Map();
    root.children.forEach((g) =>
      g.children.forEach((leaf) => leafById.set(leaf.origId, leaf))
    );

    raw.links.forEach((l) => {
      const s = leafById.get(l.source),
        t = leafById.get(l.target);
      if (s && t) s.imports.push(`${t.type}.${t.name}`);
    });

    return root;
  }

  function bilink(root) {
    const map = new Map(root.leaves().map((d) => [id(d), d]));
    root.leaves().forEach((d) => {
      d.incoming = [];
      d.outgoing = d.data.imports
        .map((i) => [d, map.get(i)])
        .filter((x) => x[1]);
    });
    root.leaves().forEach((d) => {
      d.outgoing.forEach((o) => o[1].incoming.push(o));
    });
    return root;
  }

  function id(node) {
    if (node.parent && node.parent.data.name !== "root") {
      return id(node.parent) + "." + node.data.name;
    }
    return node.data.name;
  }

  // 5) layout & draw
  function drawChart() {
    // 1) clear any existing SVG
    d3.select("body").select("svg").remove();

    // 2) compute dimensions from the current window
    const width = window.innerWidth,
      height = window.innerHeight,
      radius = Math.min(width, height) / 2 - 200;

    // 3) rebuild the hierarchy & root
    const flareData = buildFlareData(raw);
    const tree = d3.cluster().size([2 * Math.PI, radius]);
    const root = tree(
      bilink(
        d3
          .hierarchy(flareData)
          .sort((a, b) => d3.ascending(a.data.name, b.data.name))
      )
    );

    // 4) create your responsive SVG
    const svg = d3
      .select("body")
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "100vh")
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    svg
      .append("rect")
      .attr("x", -width / 2)
      .attr("y", -height / 2)
      .attr("width", width)
      .attr("height", height)
      .style("fill", "transparent")
      .lower() // send it behind everything else
      .on("click", clearSelection);

    const defs = svg.append("defs");

    defs
      .append("filter")
      .attr("id", "dropShadow")
      .append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", 2)
      .attr("result", "blur");

    defs
      .select("filter")
      .append("feOffset")
      .attr("in", "blur")
      .attr("dx", 1)
      .attr("dy", 1)
      .attr("result", "offsetBlur");

    defs
      .select("filter")
      .append("feMerge")
      .selectAll("feMergeNode")
      .data(["offsetBlur", "SourceGraphic"])
      .enter()
      .append("feMergeNode")
      .attr("in", (d) => d);

    const grad = defs
      .append("linearGradient")
      .attr("id", "linkHighlightGradient")
      .attr("gradientUnits", "objectBoundingBox")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    const n = 10;
    d3.range(n).forEach((i) => {
      grad
        .append("stop")
        .attr("offset", `${(i / (n - 1)) * 100}%`)
        .attr("stop-color", d3.interpolateRdBu(1 - i / (n - 1)));
    });

    const line = d3
      .lineRadial()
      .curve(d3.curveBundle)
      .radius((d) => d.y)
      .angle((d) => d.x);

    const linksData = root.leaves().flatMap((leaf) =>
      leaf.outgoing.map(([s, t]) => {
        const pathObj = new Path();
        line.context(pathObj)(s.path(t));
        return { path: pathObj, source: s, target: t };
      })
    );

    const color = (t) => d3.interpolateRdBu(1 - t);

    const groups = d3.group(root.leaves(), (d) => d.data.type);

    const groupAngles = new Map();
    for (const [type, leaves] of groups) {
      const meanX = d3.mean(leaves, (d) => d.x);
      groupAngles.set(type, meanX);
    }

    const groupLabels = {
      veteran: "Veterans",
      moc_skill: "MOS Skills",
      job_skill: "Job Skills",
      job: "Job Postings"
    };

    const labelConfig = {
      veteran: {
        angleOffset: -5,
        r: radius + 120,
        anchor: "start",
        rotation: -85
      },
      moc_skill: {
        angleOffset: 0,
        r: radius + 120,
        anchor: "middle",
        rotation: 95
      },
      job_skill: {
        angleOffset: +5,
        r: radius + 120,
        anchor: "middle",
        rotation: -95
      },
      job: { angleOffset: +10, r: radius + 160, anchor: "end", rotation: 85 }
    };

    svg
      .append("g")
      .selectAll("g.stage-label")
      .data([...groupAngles.entries()])
      .join("g")
      .attr("class", "stage-label")
      .attr("transform", ([type, angle]) => {
        const cfg = labelConfig[type] || {};

        const baseDeg = (angle * 180) / Math.PI - 90 + (cfg.angleOffset || 0);

        const rOuter = cfg.r != null ? cfg.r : radius + 20;
        let xform = `rotate(${baseDeg}) translate(${rOuter},0)`;

        const norm = ((baseDeg % 360) + 360) % 360;
        if (norm > 90 && norm < 270) xform += " rotate(180)";

        if (cfg.rotation) xform += ` rotate(${cfg.rotation})`;
        return xform;
      })
      .each(function ([type, angle]) {
        const g = d3.select(this);
        const label = groupLabels[type];
        const pad = 4;

        const txt = g
          .append("text")
          .attr("dy", "0.31em")
          .attr("text-anchor", labelConfig[type].anchor || "middle")
          .style("font", "16px sans-serif")
          .style("font-weight", "400")
          .style("fill", "#555")
          .text(label);

        const bbox = txt.node().getBBox();

        g.insert("rect", "text")
          .attr("x", bbox.x - pad)
          .attr("y", bbox.y - pad)
          .attr("width", bbox.width + pad * 2)
          .attr("height", bbox.height + pad * 2)
          .attr("rx", 3)
          .attr("fill", "none")
          .attr("stroke-width", 1);
      });

    const link = svg
      .append("g")
      .selectAll("path")
      .data(linksData)
      .join("path")
      .attr("class", "link")
      .attr("stroke", (d) => color((d.source.y + d.target.y) / 2 / radius))
      .attr("d", (d) => d.path.toString());

    const EXTRA_SPACING = 10;

    const nodeGroup = svg
      .append("g")
      .selectAll("g.node")
      .data(root.leaves())
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => {
        const angle = (d.x * 180) / Math.PI - 90;
        const radiusOffset =
          d.data.type === "veteran" ? d.y + EXTRA_SPACING : d.y;
        return `rotate(${angle}) translate(${radiusOffset},0)`;
      })
      .style("cursor", "pointer")
      .on("click", onClick);

    const jobPost = nodeGroup.filter((d) => d.data.type === "job");
    jobPost
      .append("circle")
      .attr("r", 3)
      .attr("fill", (d) => color(d.y / radius));
    jobPost
      .append("text")
      .attr("x", (d) => (d.x > Math.PI ? -6 : 6))
      .attr("dy", "0.31em")
      .attr("text-anchor", (d) => (d.x > Math.PI ? "end" : "start"))
      .attr("transform", (d) => (d.x > Math.PI ? "rotate(-180)" : null))
      .text((d) => d.data.name);

    const jobSkill = nodeGroup.filter((d) => d.data.type === "job_skill");
    jobSkill
      .append("circle")
      .attr("r", 3)
      .attr("fill", (d) => color(d.y / radius));
    jobSkill
      .append("text")
      .attr("x", (d) => (d.x > Math.PI ? -6 : 6))
      .attr("dy", "0.31em")
      .attr("text-anchor", (d) => (d.x > Math.PI ? "end" : "start"))
      .attr("transform", (d) => (d.x > Math.PI ? "rotate(180)" : null))
      .text((d) => d.data.name);

    const mocSkill = nodeGroup.filter((d) => d.data.type === "moc_skill");
    mocSkill
      .append("circle")
      .attr("r", 3)
      .attr("fill", (d) => color(d.y / radius));
    mocSkill
      .append("text")
      .attr("x", (d) => (d.x > Math.PI ? -6 : 6))
      .attr("dy", "0.31em")
      .attr("text-anchor", (d) => (d.x > Math.PI ? "end" : "start"))
      .attr("transform", (d) => (d.x > Math.PI ? "rotate(180)" : "rotate(0)"))
      .text((d) => d.data.name);

    // (inside your drawChart, *after* you've declared `defs`, `nodeGroup`, etc.)
    const vets = nodeGroup.filter((d) => d.data.type === "veteran");
    vets.each(function (d) {
      const g = d3.select(this),
        avatarSize = 28,
        avatarRad = avatarSize / 2,
        rawNode = raw.nodes.find((n) => n.id === d.data.origId),
        imgUrl = rawNode?.imageUrl,
        name = rawNode?.name || d.data.name,
        angleDeg = (d.x * 180) / Math.PI - 90,
        chip = g.append("g");

      // 1) draw the avatar (image or gray fallback)
      if (imgUrl) {
        defs
          .append("clipPath")
          .attr("id", `clip-${d.data.origId}`)
          .append("circle")
          .attr("r", avatarRad)
          .attr("cx", 0)
          .attr("cy", 0);

        chip
          .append("image")
          .attr("href", imgUrl)
          .attr("width", avatarSize)
          .attr("height", avatarSize)
          .attr("x", -avatarRad)
          .attr("y", -avatarRad)
          // undo the parent rotation so the face is always upright
          .attr("transform", `rotate(${-angleDeg})`)
          .attr("clip-path", `url(#clip-${d.data.origId})`);
      } else {
        chip.append("circle").attr("r", avatarRad).attr("fill", "#ccc");
      }

      // 2) hover‐only label (hidden by default)
      // const label = chip
      //   .append("text")
      //   .text(name)
      //   .attr("x", 0)
      //   .attr("y", avatarRad + 12) // just below the avatar
      //   .attr("text-anchor", "middle")
      //   .attr("font-size", "12px")
      //   .attr("fill", "#333")
      //   // undo the parent rotation so the text is always horizontal
      //   .attr("transform", `rotate(${-angleDeg})`)
      //   .style("pointer-events", "none")
      //   .style("opacity", 0);

      // capture chip's original transform (the node's rotate+translate)
      const baseTransform = chip.attr("transform") || "";

      const label = chip
        .append("text")
        .text(name)
        .attr("x", 0)
        .attr("y", avatarRad + 12)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "#333")
        .attr("transform", `rotate(${-angleDeg})`)
        .style("pointer-events", "none")
        .style("opacity", 0);

      // measure the label
      const lb = label.node().getBBox();

      // insert a white rect behind it
      const bg = chip
        .insert("rect", "text")
        .attr("x", lb.x - 4)
        .attr("y", lb.y - 2)
        .attr("width", lb.width + 8)
        .attr("height", lb.height + 4)
        .attr("rx", 4) // rounded corners
        .attr("transform", `rotate(${-angleDeg})`)
        .attr("fill", "#fff")
        .attr("stroke", "#ccc") // light gray border
        .attr("stroke-width", 1)
        .style("opacity", 0);

      // 3) scale up & show label on hover
      chip
        .on("mouseover", () => {
          // fade in text
          label.transition().duration(100).style("opacity", 1);
          // fade in background
          bg.transition().duration(100).style("opacity", 1);
          // scale up entire chip
          chip
            .transition()
            .duration(100)
            .attr("transform", `${baseTransform} scale(1.5)`);
        })
        .on("mouseout", () => {
          // fade out text
          label.transition().duration(100).style("opacity", 0);
          // fade out background
          bg.transition().duration(100).style("opacity", 0);
          // return to original scale
          chip.transition().duration(100).attr("transform", baseTransform);
        });
    });

    function clearSelection() {
      // remove all link & node highlight classes
      link.classed("highlight", false).classed("vetjob-highlight", false);
      nodeGroup.classed("node-highlight", false);

      // reset details panel
      const detailEl = document.querySelector("node-details");
      detailEl.data = {
        name: "",
        type: "",
        raw: {},
        incoming: [],
        outgoing: []
      };
      // and hide avatar
      detailEl.shadowRoot.getElementById("avatar").hidden = true;
    }

    function onClick(event, d) {
      link.classed("highlight", (l) => l.source === d || l.target === d);
      link.classed(
        "vetjob-highlight",
        (l) =>
          l.source.data.type === "veteran" &&
          l.target.data.type === "job" &&
          (l.source === d || l.target === d)
      );
      nodeGroup.classed(
        "node-highlight",
        (n) =>
          n === d ||
          d.outgoing.some(([_, t]) => t === n) ||
          d.incoming.some(([s, _]) => s === n)
      );
      const details = document.getElementById("details");
      const rawNode = raw.nodes.find((n) => n.id === d.data.origId);
      const incomingNames = d.incoming.map(([s]) => s.data.name);
      const outgoingNames = d.outgoing.map(([_, t]) => t.data.name);
      const detailEl = document.querySelector("node-details");
      detailEl.data = {
        name: d.data.name,
        type: d.data.type,
        raw: rawNode,
        incoming: incomingNames,
        outgoing: outgoingNames,
        imageUrl: rawNode.imageUrl
      };
    }
  } // initial draw
  drawChart();

  // redraw everytime the window changes size
  window.addEventListener("resize", drawChart);
})();
