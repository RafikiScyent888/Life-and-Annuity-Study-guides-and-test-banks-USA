// Study guide: numbers each topic and builds the topic list from the sections on the page,
// so adding or removing a topic never needs the list edited by hand.
(function () {
  const toc = document.getElementById("toc");
  let n = 0;
  for (const sec of document.querySelectorAll("section.topic")) {
    const badge = sec.querySelector(".badge");
    let mark = badge ? badge.textContent.trim() : "";
    if (badge && !mark) { n += 1; mark = String(n); badge.textContent = mark; }
    const title = sec.dataset.short || sec.querySelector("h2").textContent.trim();
    const a = document.createElement("a");
    a.href = `#${sec.id}`;
    a.setAttribute("style", sec.getAttribute("style") || "");
    const dot = document.createElement("span");
    dot.className = sec.classList.contains("all-parts") ? "dot rainbow" : "dot";
    const num = document.createElement("span");
    num.className = "n";
    num.textContent = mark;
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = title;
    a.append(dot, num, label);
    const li = document.createElement("li");
    li.append(a);
    toc.append(li);
  }
  // Open the topic named in the link (e.g. study-guide.html#topic-L4) once the list exists
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
  }
})();
