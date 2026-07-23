/**
 * README Changelog Updater
 * Automates the addition of commit comments to README.md
 */
const fs = require("node:fs");
const { execSync } = require("node:child_process");
const path = require("node:path");

// 0. Loop Protection: Prevent recursion if called via git hooks
if (process.env.SKIP_CHANGELOG_HOOK === "1") {
  process.exit(0);
}

// 0b. Branch Protection: Only run on main or master
const currentBranch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
if (currentBranch !== "main" && currentBranch !== "master") {
  console.log(`ℹ️ Info: Branch is "${currentBranch}" - Skipping automatic changelog updates`);
  process.exit(0);
}

const README_CONFIGS = [
  {
    path: path.join(__dirname, "README.md"),
    archiveMarker: "Older entries can be found in the [Changelog Archive]",
  },
  {
    path: path.join(__dirname, "README_de.md"),
    archiveMarker: "Ältere Einträge finden sich im [Changelog-Archiv]",
  },
];
const PKG_PATH = path.join(__dirname, "package.json");

// Files that should never appear in the changelog
const EXCLUDE_LIST = [
  path.basename(__filename),
  "package.json",
  "package-lock.json",
  "README.md",
  "CHANGELOG_OLD.md",
  "auto_version.js",
];

try {
  // 1. Get the latest commit hash and message
  const fullMsg = execSync("git log -1 --pretty=%B").toString().trim();
  // Extract first line and clean quotes
  let commitMsg = fullMsg.split("\n")[0].trim();
  commitMsg = commitMsg.replace(/^["']|["']$/g, "");

  // Manual skip via commit message tag
  if (
    commitMsg.toLowerCase().includes("[skip log]") ||
    commitMsg.toLowerCase().includes("[no changelog]")
  ) {
    console.log("[Changelog] Skipping update: [skip log] tag found.");
    process.exit(0);
  }

  // 2. Retrieve changed files in the latest commit (JS scripts in subfolders only)
  const changedFiles = execSync("git diff-tree --no-commit-id --name-only -r HEAD")
    .toString()
    .trim()
    .split("\n")
    .filter((f) => {
      if (!f) return false;
      const fileName = path.basename(f);
      const isJs = f.endsWith(".js");
      const isInSubfolder = f.includes("/") || f.includes("\\");
      const isExcluded =
        EXCLUDE_LIST.includes(fileName) || f.toLowerCase().includes("node_modules");

      if (isJs && !isInSubfolder) console.log(`[Changelog] Skipping root file: ${fileName}`);
      if (isExcluded) console.log(`[Changelog] Ignoring system file: ${fileName}`);

      return isJs && isInSubfolder && !isExcluded;
    });

  if (changedFiles.length === 0) {
    console.log("[Changelog] No relevant script changes found in this commit.");
    process.exit(0);
  }

  // 3. Read and increment version in package.json
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
  const oldVersion = pkg.version;

  function incrementPatch(v) {
    const parts = v.split(".");
    if (parts.length === 3) {
      parts[2] = parseInt(parts[2], 10) + 1;
    }
    return parts.join(".");
  }
  const currentVersion = incrementPatch(oldVersion);

  // 4. Prepare entries: One line per commit, grouping files
  const fileList = changedFiles.map((f) => path.basename(f)).join(", ");
  const newEntry = `- ${commitMsg} (${fileList})`;

  const today = new Date().toISOString().split("T")[0];
  const versionHeader = `### [${currentVersion}] - ${today}`;
  const changelogMarker = "## 📝 Changelog";

  // Loop through all README configurations
  for (const cfg of README_CONFIGS) {
    let content = fs.readFileSync(cfg.path, "utf8");

    // 5. Update Version Badge in README
    content = content.replace(/(Version-)(\d+\.\d+\.\d+)(-success)/, `$1${currentVersion}$3`);

    // 6. Logic: Handle existing or new version blocks
    if (content.includes(versionHeader)) {
      const lines = content.split("\n");
      const headerIndex = lines.findIndex((l) => l.includes(versionHeader));

      // Check if this specific entry already exists for today
      const entryExists = lines.some(
        (line, index) => index > headerIndex && line.includes(commitMsg),
      );

      if (!entryExists) {
        lines.splice(headerIndex + 1, 0, newEntry);
        content = lines.join("\n");
        console.log(
          `[Changelog] Added entry to existing version ${currentVersion} in ${path.basename(cfg.path)}.`,
        );
      } else {
        console.log(`[Changelog] Entry already exists in ${path.basename(cfg.path)}.`);
      }
    } else {
      // Create a new version block
      const newSection = `\n\n${versionHeader}\n${newEntry}`;
      content = content.replace(changelogMarker, `${changelogMarker}${newSection}`);
      console.log(
        `[Changelog] Created new block for version ${currentVersion} in ${path.basename(cfg.path)}.`,
      );
    }

    // 6b. Automatically limit README changelog to 5 entries and archive older ones
    const changelogStartIndex = content.indexOf(changelogMarker);
    const archiveStartIndex = content.indexOf(cfg.archiveMarker);

    if (changelogStartIndex !== -1 && archiveStartIndex !== -1) {
      const changelogTextStart = changelogStartIndex + changelogMarker.length;
      const changelogText = content.substring(changelogTextStart, archiveStartIndex);
      const parts = changelogText.split("### [");

      if (parts.length > 6) {
        // Keep the first 5 entries (parts[1] to parts[5])
        const header = parts[0];
        const keepBlocks = parts.slice(1, 6).map((p) => `### [${p}`);
        const archiveBlocks = parts.slice(6).map((p) => `### [${p}`);

        // Reconstruct the new changelog text for README
        const newChangelogText = header + keepBlocks.join("");

        // Build the archived entries text to move to CHANGELOG_OLD.md
        const archivedText = archiveBlocks.join("");

        // Update README content
        content =
          content.substring(0, changelogTextStart) +
          newChangelogText +
          content.substring(archiveStartIndex);

        // Update CHANGELOG_OLD.md (only once, based on the English version)
        if (cfg.path.endsWith("README.md")) {
          const OLD_CHANGELOG_PATH = path.join(__dirname, "CHANGELOG_OLD.md");
          if (!fs.existsSync(OLD_CHANGELOG_PATH)) {
            fs.writeFileSync(
              OLD_CHANGELOG_PATH,
              "# Changelog Archive\n\nThis archive contains older changelog entries for the ioBroker Script Collection.\n\n---\n",
              "utf8",
            );
          }

          let archiveContent = fs.readFileSync(OLD_CHANGELOG_PATH, "utf8");
          const markerIndex = archiveContent.indexOf("---");

          if (markerIndex !== -1) {
            const insertPos = markerIndex + "---".length;
            const before = archiveContent.substring(0, insertPos);
            const after = archiveContent.substring(insertPos);
            const formattedArchiveText = `\n\n${archivedText.trim()}\n`;
            archiveContent = before + formattedArchiveText + after.replace(/^\s+/, "\n");
          } else {
            archiveContent = `${archivedText}\n${archiveContent}`;
          }

          fs.writeFileSync(OLD_CHANGELOG_PATH, archiveContent, "utf8");
          console.log(
            `[Changelog] Archived ${archiveBlocks.length} older entry/entries to CHANGELOG_OLD.md.`,
          );

          // Stage CHANGELOG_OLD.md as well
          execSync(`git add "${OLD_CHANGELOG_PATH}"`);
        }
      }
    }

    fs.writeFileSync(cfg.path, content, "utf8");
    console.log(
      `[Changelog] ${path.basename(cfg.path)} successfully updated to version ${currentVersion}.`,
    );
  }

  // Write updated package.json
  pkg.version = currentVersion;
  fs.writeFileSync(PKG_PATH, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`[Changelog] package.json updated: ${oldVersion} -> ${currentVersion}`);

  // 7. ATOMIC UPDATE: Amend the commit to include package.json and both README changes
  const readmePathsList = README_CONFIGS.map((cfg) => `"${cfg.path}"`).join(" ");
  execSync(`git add "${PKG_PATH}" ${readmePathsList}`);

  execSync("git commit --amend --no-edit", {
    env: { ...process.env, SKIP_CHANGELOG_HOOK: "1" },
    stdio: "inherit",
  });

  console.log(`[Changelog] Commit amended with README and package.json updates. Ready to sync.`);
} catch (error) {
  console.error("[Changelog] Error updating README:", error.message);
  process.exit(1);
}
