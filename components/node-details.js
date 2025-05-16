const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 260px;
      max-height: 80vh;
      overflow-y: auto;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 16px;
      font: 13px sans-serif;
      color: #333;
      display: block;
    }
    img {
      /* when present, show as a cover image */
      width: 100px;
      height: auto;
      max-height: 150px;
      object-fit: cover;
      border-radius: 4px;
      margin-bottom: 8px;
      display: block;
    }
    /* this honors the hidden attribute */
    img[hidden] {
      display: none !important;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 1.1em;
      color: #222;
    }
    .type {
      font-weight: bold;
      margin-bottom: 8px;
      display: block;
    }
    /* replaced <pre> with a description list */
    dl#raw-data dt {
      font-weight: bold;
      margin-top: 4px;
    }
    dl#raw-data dd {
      margin: 0 0 4px 16px;
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 12px;
    }
    ul {
      padding-left: 16px;
      margin: 8px 0;
    }
    li {
      margin-bottom: 4px;
    }
  </style>

  <!-- avatar is controlled via its hidden attribute -->
  <img id="avatar" src="" alt="Avatar" hidden />

  <!-- only this inner div gets blown away on updates -->
  <div id="content">
    <em>Click a node to see details here</em>
  </div>
`;

class NodeDetails extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.appendChild(template.content.cloneNode(true));
    this.$avatar = root.getElementById("avatar");
    this.$content = root.getElementById("content");
  }

  /**
   * Reset to the “nothing selected” UI
   */
  clear() {
    this.$avatar.hidden = true;
    this.$content.innerHTML = `<em>Click a node to see details here</em>`;
  }

  /**
   * @param {{ name:string, type:string, raw:any, incoming:string[], outgoing:string[], imageUrl?:string }} data
   */
  set data({ name, type, raw, incoming, outgoing, imageUrl }) {
    if (!name) {
      return this.clear();
    }

    if (imageUrl) {
      this.$avatar.src = imageUrl;
      this.$avatar.hidden = false;
    } else {
      this.$avatar.hidden = true;
    }

    // build <dl> entries from raw object
    const rawEntries = Object.entries(raw || {})
      .map(([key, val]) => {
        const pretty =
          typeof val === "object" ? JSON.stringify(val, null, 2) : val;
        return `<dt>${key}</dt><dd>${pretty}</dd>`;
      })
      .join("");

    this.$content.innerHTML = `
      <h3>${name}</h3>
      <span class="type">${type.replace("_", " ").toUpperCase()}</span>

      <div><strong>Raw Data:</strong></div>
      <dl id="raw-data">
        ${rawEntries}
      </dl>

      ${
        Array.isArray(incoming) && incoming.length
          ? `<div><strong>Incoming from:</strong></div>
             <ul>${incoming.map((n) => `<li>${n}</li>`).join("")}</ul>`
          : ``
      }
      ${
        Array.isArray(outgoing) && outgoing.length
          ? `<div><strong>Outgoing to:</strong></div>
             <ul>${outgoing.map((n) => `<li>${n}</li>`).join("")}</ul>`
          : ``
      }
    `;
  }
}

customElements.define("node-details", NodeDetails);
