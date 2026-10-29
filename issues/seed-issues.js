const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const issuesPath = path.join(__dirname, 'issues.json');
const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));

console.log(`Starting seed of ${issues.length} issues to chizzy0011/aegis-protocol...`);

// Ensure labels exist
const requiredLabels = [
  { name: 'Stellar Wave', color: '38BDF8', desc: 'Official Drips Stellar Wave Program' },
  { name: 'High', color: 'EF4444', desc: 'High complexity (200 Pts)' },
  { name: 'Medium', color: 'F59E0B', desc: 'Medium complexity (150 Pts)' },
  { name: 'Trivial', color: '10B981', desc: 'Trivial complexity (100 Pts)' },
  { name: 'contracts', color: '8B5CF6', desc: 'Soroban smart contracts' },
  { name: 'repo', color: 'EC4899', desc: 'Bilateral repo engine' },
  { name: 'credit', color: 'F97316', desc: 'Structured trade credit' },
  { name: 'compliance', color: '6366F1', desc: 'Institutional KYC & SEP-8' },
  { name: 'settlement', color: '14B8A6', desc: 'Stellar fiat anchor settlement' },
  { name: 'oracles', color: '06B6D4', desc: 'Oracles & price feeds' },
  { name: 'sdk', color: '3B82F6', desc: 'TypeScript SDK' },
  { name: 'watcher', color: 'EAB308', desc: 'Margin watcher daemon' },
  { name: 'web', color: '64748B', desc: 'Institutional web portal' }
];

for (const lbl of requiredLabels) {
  try {
    execSync(`gh label create "${lbl.name}" --color "${lbl.color}" --description "${lbl.desc}" --repo chizzy0011/aegis-protocol --force`, { stdio: 'ignore' });
  } catch (err) {
    // Label may already exist
  }
}
console.log('Labels configured successfully.');

let createdCount = 0;
for (const issue of issues) {
  try {
    const labelArgs = issue.labels.map(l => `--label "${l}"`).join(' ');
    const tempBodyFile = path.join(__dirname, `temp_body_${issue.id}.md`);
    fs.writeFileSync(tempBodyFile, issue.body, 'utf8');

    execSync(
      `gh issue create --repo chizzy0011/aegis-protocol --title "${issue.title.replace(/"/g, '\\"')}" --body-file "${tempBodyFile}" ${labelArgs}`,
      { stdio: 'ignore' }
    );

    try { fs.unlinkSync(tempBodyFile); } catch (e) {}

    createdCount++;
    if (createdCount % 10 === 0 || createdCount === issues.length) {
      console.log(`Progress: ${createdCount}/${issues.length} issues seeded.`);
    }
  } catch (err) {
    console.error(`Error creating issue #${issue.id}: ${err.message}`);
  }
}

console.log(`Seeding complete: ${createdCount} issues live on GitHub.`);
