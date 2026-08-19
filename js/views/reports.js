// views/reports.js — reports view (summary + export).
// Uses GET /dashboard (admin: full scope; manager: department scope) and
// GET /export. Technicians never access this view (backend denies reports.read);
// their board still offers own-scope export via GET /export.

const ReportsView = {
  loaded: false,

  async init() {
    if (this.loaded) {
      await this.refresh();
      return;
    }
    this.loaded = true;
    const exportButton = document.getElementById("reportsExportButton");
    if (exportButton) {
      exportButton.addEventListener("click", () => this.exportExcel());
    }
    await this.refresh();
  },

  async refresh() {
    const target = document.getElementById("reportsContent");
    if (!target) return;
    setLoading(target, true);
    try {
      const dashboard = await apiGet("/dashboard");
      this.renderSummary(dashboard && dashboard.summary);
    } catch (error) {
      target.innerHTML = errorState(error.message);
      showToast(error.message, true);
    }
  },

  renderSummary(summary) {
    const target = document.getElementById("reportsContent");
    if (!target) return;
    if (!summary) {
      target.innerHTML = `<div class="panel">${emptyState("მონაცემები არ არის.")}</div>`;
      return;
    }

    const cards = [
      { label: "სულ დავალებები", value: summary.total || 0, className: "metric-card--yellow" },
      { label: "მისაღები", value: summary.pending || 0 },
      { label: "მიმდინარეობს", value: summary.in_progress || 0 },
      { label: "დაბლოკილი", value: summary.blocked || 0, className: "metric-card--alert" },
      { label: "დასრულებული", value: summary.done || 0 },
      { label: "ვადაგადაცილებული", value: summary.overdue || 0 }
    ];

    target.innerHTML = `
      <div class="metrics-grid reports-metrics" aria-label="ანგარიშის მაჩვენებლები">
        ${cards
          .map(
            (card) => `
              <article class="metric-card ${card.className || ""}">
                <span class="metric-card__label">${card.label}</span>
                <strong>${card.value}</strong>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="panel reports-export-panel">
        <div>
          <span class="workspace-kicker">ექსპორტი</span>
          <h2>დავალებების ექსპორტი</h2>
          <p>ჩამოტვირთე დავალებების სია Excel ფორმატში.</p>
        </div>
        <button type="button" class="btn btn--primary" id="reportsExportButtonInline">Excel ექსპორტი</button>
      </div>
    `;

    const inlineButton = document.getElementById("reportsExportButtonInline");
    if (inlineButton) inlineButton.addEventListener("click", () => this.exportExcel());
  },

  async exportExcel() {
    try {
      const blob = await apiDownload("/export");
      downloadBlob(blob, STRINGS.exportFileName);
    } catch (error) {
      showToast(error.message, true);
    }
  }
};