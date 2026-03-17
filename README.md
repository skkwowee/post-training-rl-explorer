# Post-Training RL Explorer

An interactive guide to the reinforcement learning techniques used to align large language models after pre-training.

**Live site: [skkwowee.github.io/post-training-rl-explorer](https://skkwowee.github.io/post-training-rl-explorer/)**

## Methods Covered

- **RLHF / PPO** — Reward model + proximal policy optimization
- **DPO** — Direct preference optimization (no reward model)
- **KTO** — Kahneman-Tversky optimization (binary feedback + prospect theory)
- **GRPO** — Group relative policy optimization (no critic network)
- **SimPO** — Simple preference optimization (no reference model)

Each method includes a conceptual explanation with math, interactive Chart.js visualizations with parameter sliders, pseudocode, and pros/cons.

## Usage

Open `index.html` in a browser. No build step required.
