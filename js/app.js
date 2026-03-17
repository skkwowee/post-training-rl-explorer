// ===== Navigation =====
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.nav-tab');
  const sections = document.querySelectorAll('.section');

  function switchTab(targetId) {
    sections.forEach(s => s.classList.remove('active'));
    tabs.forEach(t => t.classList.remove('active'));
    document.getElementById(targetId)?.classList.add('active');
    document.querySelector(`[data-target="${targetId}"]`)?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.target));
  });

  // ===== Render KaTeX =====
  document.querySelectorAll('.math-render').forEach(el => {
    try {
      katex.render(el.dataset.formula, el, { displayMode: true, throwOnError: false });
    } catch (e) { el.textContent = el.dataset.formula; }
  });
  document.querySelectorAll('.math-inline').forEach(el => {
    try {
      katex.render(el.dataset.formula, el, { displayMode: false, throwOnError: false });
    } catch (e) { el.textContent = el.dataset.formula; }
  });

  // ===== Chart.js Global Config =====
  Chart.defaults.color = '#7a6f63';
  Chart.defaults.borderColor = 'rgba(200,191,176,0.4)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  // ===== 1. RLHF/PPO: Clipping Function =====
  const ppoCtx = document.getElementById('ppo-chart')?.getContext('2d');
  let ppoChart;
  if (ppoCtx) {
    function ppoData(epsilon) {
      const points = [];
      const clippedPoints = [];
      const ratios = [];
      for (let r = 0.5; r <= 1.5; r += 0.01) {
        ratios.push(r.toFixed(2));
        const adv = 1; // positive advantage
        const unclipped = r * adv;
        const clipped = Math.min(Math.max(r, 1 - epsilon), 1 + epsilon) * adv;
        const obj = Math.min(unclipped, clipped);
        points.push(obj);
        clippedPoints.push(clipped);
      }
      return { ratios, points, clippedPoints };
    }

    function createPPOChart(epsilon) {
      const d = ppoData(epsilon);
      return new Chart(ppoCtx, {
        type: 'line',
        data: {
          labels: d.ratios,
          datasets: [
            {
              label: 'PPO Objective (min of clipped, unclipped)',
              data: d.points,
              borderColor: '#b33d26',
              backgroundColor: 'rgba(179,61,38,0.1)',
              borderWidth: 2.5,
              pointRadius: 0,
              fill: true,
            },
            {
              label: 'Clipped ratio × advantage',
              data: d.clippedPoints,
              borderColor: '#c47a1a',
              borderWidth: 1.5,
              borderDash: [5, 5],
              pointRadius: 0,
              fill: false,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { boxWidth: 12 } } },
          scales: {
            x: { title: { display: true, text: 'Probability Ratio r(θ)' }, ticks: { maxTicksLimit: 10 } },
            y: { title: { display: true, text: 'Objective' } }
          }
        }
      });
    }

    ppoChart = createPPOChart(0.2);

    document.getElementById('ppo-epsilon')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById('ppo-epsilon-val').textContent = val.toFixed(2);
      ppoChart.destroy();
      ppoChart = createPPOChart(val);
    });
  }

  // ===== 2. DPO: Loss Landscape =====
  const dpoCtx = document.getElementById('dpo-chart')?.getContext('2d');
  let dpoChart;
  if (dpoCtx) {
    function dpoData(beta) {
      const margins = [];
      const lossVals = [];
      for (let m = -4; m <= 4; m += 0.1) {
        margins.push(m.toFixed(1));
        // DPO loss: -log(sigmoid(beta * margin))
        const loss = -Math.log(1 / (1 + Math.exp(-beta * m)));
        lossVals.push(loss);
      }
      return { margins, lossVals };
    }

    function createDPOChart(beta) {
      const d = dpoData(beta);
      return new Chart(dpoCtx, {
        type: 'line',
        data: {
          labels: d.margins,
          datasets: [{
            label: `DPO Loss (β=${beta.toFixed(1)})`,
            data: d.lossVals,
            borderColor: '#b33d26',
            backgroundColor: 'rgba(179,61,38,0.1)',
            borderWidth: 2.5,
            pointRadius: 0,
            fill: true,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { boxWidth: 12 } } },
          scales: {
            x: { title: { display: true, text: 'Reward Margin: r(y_w) - r(y_l)' }, ticks: { maxTicksLimit: 10 } },
            y: { title: { display: true, text: 'Loss' }, min: 0, max: 5 }
          }
        }
      });
    }

    dpoChart = createDPOChart(0.1);

    document.getElementById('dpo-beta')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById('dpo-beta-val').textContent = val.toFixed(1);
      dpoChart.destroy();
      dpoChart = createDPOChart(val);
    });
  }

  // ===== DPO Preference Demo =====
  const dpoPairs = [
    {
      prompt: "Explain quantum computing in simple terms.",
      a: "Quantum computing uses qubits that can be 0 and 1 simultaneously (superposition), letting quantum computers explore many solutions at once. It's like checking every path in a maze at the same time instead of one by one.",
      b: "Quantum computing is a type of computation that harnesses quantum mechanical phenomena such as superposition, entanglement, and interference to process information in fundamentally different ways than classical computers.",
      better: 'a',
      reason: "Response A uses a concrete analogy (maze) making it more accessible, while B is technically dense."
    },
    {
      prompt: "What's the best way to learn programming?",
      a: "Just read the documentation for a programming language cover to cover, then you'll understand everything.",
      b: "Start with a small project you care about — a personal website, a game, or a tool. Learn what you need as you go, use tutorials for specific concepts, and don't be afraid to Google everything. Consistency beats intensity.",
      better: 'b',
      reason: "Response B gives actionable, practical advice with specific examples. A is unrealistic and unhelpful."
    },
    {
      prompt: "How do vaccines work?",
      a: "Vaccines introduce a harmless piece of a pathogen (like a protein or weakened virus) to your immune system. Your body learns to recognize it and builds memory cells, so if you encounter the real pathogen later, your immune system responds quickly before you get seriously ill.",
      b: "Vaccines are biological preparations that provide active acquired immunity to particular infectious diseases. They typically contain an agent resembling the disease-causing microorganism.",
      better: 'a',
      reason: "Response A explains the mechanism clearly with cause-and-effect, while B reads like an encyclopedia entry without explaining *how* immunity develops."
    }
  ];

  let dpoIdx = 0;
  const demoPrompt = document.getElementById('dpo-demo-prompt');
  const demoA = document.getElementById('dpo-demo-a');
  const demoB = document.getElementById('dpo-demo-b');
  const demoFeedback = document.getElementById('dpo-demo-feedback');
  const demoNext = document.getElementById('dpo-demo-next');

  function loadDPOPair() {
    const pair = dpoPairs[dpoIdx % dpoPairs.length];
    if (demoPrompt) demoPrompt.textContent = `"${pair.prompt}"`;
    if (demoA) { demoA.textContent = pair.a; demoA.className = 'demo-response'; delete demoA.dataset.chosen; }
    if (demoB) { demoB.textContent = pair.b; demoB.className = 'demo-response'; delete demoB.dataset.chosen; }
    if (demoFeedback) { demoFeedback.className = 'demo-feedback'; demoFeedback.textContent = ''; }
  }

  function chooseDPO(choice) {
    const pair = dpoPairs[dpoIdx % dpoPairs.length];
    const isCorrect = choice === pair.better;
    if (demoA) demoA.className = 'demo-response ' + (pair.better === 'a' ? 'selected-win' : 'selected-lose');
    if (demoB) demoB.className = 'demo-response ' + (pair.better === 'b' ? 'selected-win' : 'selected-lose');
    if (demoFeedback) {
      demoFeedback.className = 'demo-feedback show ' + (isCorrect ? 'correct' : 'incorrect');
      demoFeedback.textContent = (isCorrect ? '✓ Correct! ' : '✗ Different from expert label. ') + pair.reason;
    }
  }

  if (demoA) demoA.addEventListener('click', () => chooseDPO('a'));
  if (demoB) demoB.addEventListener('click', () => chooseDPO('b'));
  if (demoNext) demoNext.addEventListener('click', () => { dpoIdx++; loadDPOPair(); });
  loadDPOPair();

  // ===== 3. KTO: Prospect Theory Value Function =====
  const ktoCtx = document.getElementById('kto-chart')?.getContext('2d');
  let ktoChart;
  if (ktoCtx) {
    function ktoData(lossAversion) {
      const xs = [];
      const vals = [];
      for (let x = -3; x <= 3; x += 0.05) {
        xs.push(x.toFixed(2));
        // Prospect theory value: concave for gains, convex + steeper for losses
        const v = x >= 0
          ? Math.pow(x, 0.88)
          : -lossAversion * Math.pow(-x, 0.88);
        vals.push(v);
      }
      return { xs, vals };
    }

    function createKTOChart(lambda) {
      const d = ktoData(lambda);
      return new Chart(ktoCtx, {
        type: 'line',
        data: {
          labels: d.xs,
          datasets: [{
            label: `Value Function (λ=${lambda.toFixed(1)})`,
            data: d.vals,
            borderColor: '#b33d26',
            backgroundColor: (ctx) => {
              const chart = ctx.chart;
              const { ctx: c, chartArea } = chart;
              if (!chartArea) return 'rgba(179,61,38,0.1)';
              const gradient = c.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
              gradient.addColorStop(0, 'rgba(179,61,38,0.15)');
              gradient.addColorStop(0.5, 'rgba(179,61,38,0.05)');
              gradient.addColorStop(1, 'rgba(58,125,68,0.15)');
              return gradient;
            },
            borderWidth: 2.5,
            pointRadius: 0,
            fill: true,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { boxWidth: 12 } } },
          scales: {
            x: { title: { display: true, text: 'Outcome (reward relative to reference)' }, ticks: { maxTicksLimit: 10 } },
            y: { title: { display: true, text: 'Perceived Value v(x)' } }
          }
        }
      });
    }

    ktoChart = createKTOChart(2.25);

    document.getElementById('kto-lambda')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById('kto-lambda-val').textContent = val.toFixed(1);
      ktoChart.destroy();
      ktoChart = createKTOChart(val);
    });
  }

  // ===== KTO Binary Feedback Demo =====
  const ktoResponses = [
    { prompt: "Write a haiku about programming.", text: "Bugs hide in the code\nSilent errors multiply\nCoffee fuels the fix", quality: 'good' },
    { prompt: "Write a haiku about programming.", text: "Programming is fun\nYou write code on a computer\nThen you run the code", quality: 'bad' },
    { prompt: "Explain gravity in one sentence.", text: "Gravity is the curvature of spacetime caused by mass and energy, making objects follow curved paths that we perceive as attraction.", quality: 'good' },
    { prompt: "Explain gravity in one sentence.", text: "Gravity is a force that pulls things down to the ground because of science reasons.", quality: 'bad' },
    { prompt: "Give a tip for public speaking.", text: "Pause deliberately before key points — silence creates anticipation and gives your audience time to absorb what you just said.", quality: 'good' },
    { prompt: "Give a tip for public speaking.", text: "Just imagine everyone in their underwear and you won't be nervous anymore.", quality: 'bad' },
  ];

  let ktoIdx = 0;
  let ktoThumbs = { up: 0, down: 0, correct: 0, total: 0 };
  const ktoPromptEl = document.getElementById('kto-demo-prompt');
  const ktoTextEl = document.getElementById('kto-demo-text');
  const ktoFeedbackEl = document.getElementById('kto-demo-feedback');

  function loadKTOItem() {
    const item = ktoResponses[ktoIdx % ktoResponses.length];
    if (ktoPromptEl) ktoPromptEl.textContent = `"${item.prompt}"`;
    if (ktoTextEl) ktoTextEl.textContent = item.text;
    if (ktoFeedbackEl) { ktoFeedbackEl.className = 'demo-feedback'; ktoFeedbackEl.textContent = ''; }
  }

  window.ktoVote = function(vote) {
    const item = ktoResponses[ktoIdx % ktoResponses.length];
    const isCorrect = (vote === 'up' && item.quality === 'good') || (vote === 'down' && item.quality === 'bad');
    if (vote === 'up') ktoThumbs.up++;
    else ktoThumbs.down++;
    ktoThumbs.total++;
    if (isCorrect) ktoThumbs.correct++;
    if (ktoFeedbackEl) {
      ktoFeedbackEl.className = 'demo-feedback show ' + (isCorrect ? 'correct' : 'incorrect');
      ktoFeedbackEl.textContent = isCorrect
        ? `✓ Matches expert label (${item.quality})! Accuracy: ${((ktoThumbs.correct / ktoThumbs.total) * 100).toFixed(0)}%`
        : `✗ Expert labeled this as "${item.quality}". Accuracy: ${((ktoThumbs.correct / ktoThumbs.total) * 100).toFixed(0)}%`;
    }
    document.getElementById('kto-stat-up').textContent = ktoThumbs.up;
    document.getElementById('kto-stat-down').textContent = ktoThumbs.down;
    setTimeout(() => { ktoIdx++; loadKTOItem(); }, 1200);
  };

  loadKTOItem();

  // ===== 4. GRPO: Group Relative Advantages =====
  const grpoCtx = document.getElementById('grpo-chart')?.getContext('2d');
  let grpoChart;

  function sampleGRPO() {
    const G = 8; // group size
    const scores = [];
    for (let i = 0; i < G; i++) {
      scores.push(parseFloat((Math.random() * 10).toFixed(1)));
    }
    const mean = scores.reduce((a, b) => a + b, 0) / G;
    const std = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / G) || 1;
    const advantages = scores.map(s => ((s - mean) / std));
    return { scores, advantages, mean, std };
  }

  function renderGRPO() {
    const { scores, advantages, mean } = sampleGRPO();
    const labels = scores.map((s, i) => `y${i + 1}`);

    if (grpoChart) grpoChart.destroy();
    if (grpoCtx) {
      grpoChart = new Chart(grpoCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Reward Score',
              data: scores,
              backgroundColor: 'rgba(179,61,38,0.6)',
              borderColor: '#b33d26',
              borderWidth: 1,
              yAxisID: 'y',
            },
            {
              label: 'Advantage (normalized)',
              data: advantages.map(a => parseFloat(a.toFixed(2))),
              backgroundColor: advantages.map(a => a >= 0 ? 'rgba(58,125,68,0.6)' : 'rgba(179,61,38,0.6)'),
              borderColor: advantages.map(a => a >= 0 ? '#3a7d44' : '#b33d26'),
              borderWidth: 1,
              yAxisID: 'y1',
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { boxWidth: 12 } },
            annotation: {
              annotations: {
                meanLine: {
                  type: 'line',
                  yMin: mean,
                  yMax: mean,
                  borderColor: '#c47a1a',
                  borderWidth: 2,
                  borderDash: [6, 3],
                  label: { content: `μ = ${mean.toFixed(1)}`, display: true, position: 'end', backgroundColor: 'rgba(196,122,26,0.85)', font: { size: 11 } }
                }
              }
            }
          },
          scales: {
            y: { position: 'left', title: { display: true, text: 'Reward' }, min: 0, max: 10 },
            y1: { position: 'right', title: { display: true, text: 'Advantage' }, grid: { drawOnChartArea: false } }
          }
        }
      });
    }

    // Update sample cards
    const container = document.getElementById('grpo-samples');
    if (container) {
      container.innerHTML = scores.map((s, i) => {
        const adv = advantages[i];
        return `<div class="grpo-sample">
          <span class="score">${s.toFixed(1)}</span>
          <span class="advantage ${adv >= 0 ? 'positive' : 'negative'}">${adv >= 0 ? '+' : ''}${adv.toFixed(2)}</span>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-top:0.3rem">Sample ${i + 1}</div>
        </div>`;
      }).join('');
    }
  }

  document.getElementById('grpo-resample')?.addEventListener('click', renderGRPO);
  renderGRPO();

  // ===== 5. SimPO: Loss Comparison =====
  const simpoCtx = document.getElementById('simpo-chart')?.getContext('2d');
  let simpoChart;
  if (simpoCtx) {
    function simpoData(gamma) {
      const margins = [];
      const dpoLoss = [];
      const simpoLoss = [];
      for (let m = -4; m <= 4; m += 0.1) {
        margins.push(m.toFixed(1));
        // DPO: -log(sigmoid(beta * m))
        const beta = 0.1;
        dpoLoss.push(-Math.log(1 / (1 + Math.exp(-beta * m))));
        // SimPO: -log(sigmoid(beta * (m - gamma)))
        simpoLoss.push(-Math.log(1 / (1 + Math.exp(-beta * (m - gamma)))));
      }
      return { margins, dpoLoss, simpoLoss };
    }

    function createSimPOChart(gamma) {
      const d = simpoData(gamma);
      return new Chart(simpoCtx, {
        type: 'line',
        data: {
          labels: d.margins,
          datasets: [
            {
              label: 'DPO Loss',
              data: d.dpoLoss,
              borderColor: '#a09688',
              borderWidth: 2,
              borderDash: [5, 5],
              pointRadius: 0,
              fill: false,
            },
            {
              label: `SimPO Loss (γ=${gamma.toFixed(1)})`,
              data: d.simpoLoss,
              borderColor: '#b33d26',
              backgroundColor: 'rgba(179,61,38,0.1)',
              borderWidth: 2.5,
              pointRadius: 0,
              fill: true,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { boxWidth: 12 } } },
          scales: {
            x: { title: { display: true, text: 'Reward Margin' }, ticks: { maxTicksLimit: 10 } },
            y: { title: { display: true, text: 'Loss' }, min: 0, max: 5 }
          }
        }
      });
    }

    simpoChart = createSimPOChart(1.0);

    document.getElementById('simpo-gamma')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById('simpo-gamma-val').textContent = val.toFixed(1);
      simpoChart.destroy();
      simpoChart = createSimPOChart(val);
    });
  }
});
