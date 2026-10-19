import "dotenv/config";
import { db, ensureDbInitialized } from "../src/db";
import { badges, problems, system_state } from "../src/db/schema";
import { fetchProblemsFromApi, type ApiProblemItem } from "../src/lib/leetcode";
import { drawDailyChallengesForDate } from "../src/lib/sync-engine";
import { getTodayUtcDateString } from "../src/lib/utils";
import { notInArray, sql } from "drizzle-orm";

const INITIAL_BADGES = [
  {
    code: "FIRST_BLOOD",
    name: "Pierwsza Krew",
    description: "Rozwiąż swoje pierwsze dzienne wyzwanie w LeetSquad.",
    icon: "🩸",
  },
  {
    code: "PERFECTIONIST",
    name: "Perfekcjonista",
    description:
      "Rozwiąż komplet 3 dziennych zadań (Easy, Medium i Hard) jednego dnia.",
    icon: "💎",
  },
  {
    code: "EARLY_BIRD",
    name: "Ranny Ptaszek",
    description: "Rozwiąż zadanie między godziną 04:00 a 08:00 czasu UTC.",
    icon: "🌅",
  },
  {
    code: "NIGHT_OWL",
    name: "Nocny Marek",
    description: "Rozwiąż zadanie w godzinach nocnych (22:00 – 04:00 UTC).",
    icon: "🦉",
  },
  {
    code: "STREAK_7",
    name: "Tydzień w Ogniu",
    description: "Utrzymaj nieprzerwany 7-dniowy streak rozwiązywania zadań.",
    icon: "🔥",
  },
  {
    code: "STREAK_30",
    name: "Niezniszczalny",
    description: "Utrzymaj legendarny 30-dniowy streak rozwiązywania zadań.",
    icon: "👑",
  },
  {
    code: "HARD_HITTER",
    name: "Pogromca Hardów",
    description: "Rozwiąż przynajmniej jedno dzienne wyzwanie o trudności Hard.",
    icon: "⚔️",
  },
  {
    code: "POLYGLOT",
    name: "Poliglota",
    description:
      "Rozwiąż zadania używając co najmniej 3 różnych języków programowania.",
    icon: "🌐",
  },
];

/**
 * Pełna lista 150 zadań z planu "Top Interview 150"
 * https://leetcode.com/studyplan/top-interview-150/
 */
const TOP_INTERVIEW_150: ApiProblemItem[] = [
  // Array / String (24)
  { id: 88, title: "Merge Sorted Array", titleSlug: "merge-sorted-array", difficulty: "Easy" },
  { id: 27, title: "Remove Element", titleSlug: "remove-element", difficulty: "Easy" },
  { id: 26, title: "Remove Duplicates from Sorted Array", titleSlug: "remove-duplicates-from-sorted-array", difficulty: "Easy" },
  { id: 80, title: "Remove Duplicates from Sorted Array II", titleSlug: "remove-duplicates-from-sorted-array-ii", difficulty: "Medium" },
  { id: 169, title: "Majority Element", titleSlug: "majority-element", difficulty: "Easy" },
  { id: 189, title: "Rotate Array", titleSlug: "rotate-array", difficulty: "Medium" },
  { id: 121, title: "Best Time to Buy and Sell Stock", titleSlug: "best-time-to-buy-and-sell-stock", difficulty: "Easy" },
  { id: 122, title: "Best Time to Buy and Sell Stock II", titleSlug: "best-time-to-buy-and-sell-stock-ii", difficulty: "Medium" },
  { id: 55, title: "Jump Game", titleSlug: "jump-game", difficulty: "Medium" },
  { id: 45, title: "Jump Game II", titleSlug: "jump-game-ii", difficulty: "Medium" },
  { id: 274, title: "H-Index", titleSlug: "h-index", difficulty: "Medium" },
  { id: 380, title: "Insert Delete GetRandom O(1)", titleSlug: "insert-delete-getrandom-o1", difficulty: "Medium" },
  { id: 238, title: "Product of Array Except Self", titleSlug: "product-of-array-except-self", difficulty: "Medium" },
  { id: 134, title: "Gas Station", titleSlug: "gas-station", difficulty: "Medium" },
  { id: 135, title: "Candy", titleSlug: "candy", difficulty: "Hard" },
  { id: 42, title: "Trapping Rain Water", titleSlug: "trapping-rain-water", difficulty: "Hard" },
  { id: 13, title: "Roman to Integer", titleSlug: "roman-to-integer", difficulty: "Easy" },
  { id: 12, title: "Integer to Roman", titleSlug: "integer-to-roman", difficulty: "Medium" },
  { id: 58, title: "Length of Last Word", titleSlug: "length-of-last-word", difficulty: "Easy" },
  { id: 14, title: "Longest Common Prefix", titleSlug: "longest-common-prefix", difficulty: "Easy" },
  { id: 151, title: "Reverse Words in a String", titleSlug: "reverse-words-in-a-string", difficulty: "Medium" },
  { id: 6, title: "Zigzag Conversion", titleSlug: "zigzag-conversion", difficulty: "Medium" },
  { id: 28, title: "Find the Index of the First Occurrence in a String", titleSlug: "find-the-index-of-the-first-occurrence-in-a-string", difficulty: "Easy" },
  { id: 68, title: "Text Justification", titleSlug: "text-justification", difficulty: "Hard" },

  // Two Pointers (5)
  { id: 125, title: "Valid Palindrome", titleSlug: "valid-palindrome", difficulty: "Easy" },
  { id: 392, title: "Is Subsequence", titleSlug: "is-subsequence", difficulty: "Easy" },
  { id: 167, title: "Two Sum II - Input Array Is Sorted", titleSlug: "two-sum-ii-input-array-is-sorted", difficulty: "Medium" },
  { id: 11, title: "Container With Most Water", titleSlug: "container-with-most-water", difficulty: "Medium" },
  { id: 15, title: "3Sum", titleSlug: "3sum", difficulty: "Medium" },

  // Sliding Window (4)
  { id: 209, title: "Minimum Size Subarray Sum", titleSlug: "minimum-size-subarray-sum", difficulty: "Medium" },
  { id: 3, title: "Longest Substring Without Repeating Characters", titleSlug: "longest-substring-without-repeating-characters", difficulty: "Medium" },
  { id: 30, title: "Substring with Concatenation of All Words", titleSlug: "substring-with-concatenation-of-all-words", difficulty: "Hard" },
  { id: 76, title: "Minimum Window Substring", titleSlug: "minimum-window-substring", difficulty: "Hard" },

  // Matrix (5)
  { id: 36, title: "Valid Sudoku", titleSlug: "valid-sudoku", difficulty: "Medium" },
  { id: 54, title: "Spiral Matrix", titleSlug: "spiral-matrix", difficulty: "Medium" },
  { id: 48, title: "Rotate Image", titleSlug: "rotate-image", difficulty: "Medium" },
  { id: 73, title: "Set Matrix Zeroes", titleSlug: "set-matrix-zeroes", difficulty: "Medium" },
  { id: 289, title: "Game of Life", titleSlug: "game-of-life", difficulty: "Medium" },

  // Hashmap (9)
  { id: 383, title: "Ransom Note", titleSlug: "ransom-note", difficulty: "Easy" },
  { id: 205, title: "Isomorphic Strings", titleSlug: "isomorphic-strings", difficulty: "Easy" },
  { id: 290, title: "Word Pattern", titleSlug: "word-pattern", difficulty: "Easy" },
  { id: 242, title: "Valid Anagram", titleSlug: "valid-anagram", difficulty: "Easy" },
  { id: 49, title: "Group Anagrams", titleSlug: "group-anagrams", difficulty: "Medium" },
  { id: 1, title: "Two Sum", titleSlug: "two-sum", difficulty: "Easy" },
  { id: 202, title: "Happy Number", titleSlug: "happy-number", difficulty: "Easy" },
  { id: 219, title: "Contains Duplicate II", titleSlug: "contains-duplicate-ii", difficulty: "Easy" },
  { id: 128, title: "Longest Consecutive Sequence", titleSlug: "longest-consecutive-sequence", difficulty: "Medium" },

  // Intervals (4)
  { id: 228, title: "Summary Ranges", titleSlug: "summary-ranges", difficulty: "Easy" },
  { id: 56, title: "Merge Intervals", titleSlug: "merge-intervals", difficulty: "Medium" },
  { id: 57, title: "Insert Interval", titleSlug: "insert-interval", difficulty: "Medium" },
  { id: 452, title: "Minimum Number of Arrows to Burst Balloons", titleSlug: "minimum-number-of-arrows-to-burst-balloons", difficulty: "Medium" },

  // Stack (5)
  { id: 20, title: "Valid Parentheses", titleSlug: "valid-parentheses", difficulty: "Easy" },
  { id: 71, title: "Simplify Path", titleSlug: "simplify-path", difficulty: "Medium" },
  { id: 155, title: "Min Stack", titleSlug: "min-stack", difficulty: "Medium" },
  { id: 150, title: "Evaluate Reverse Polish Notation", titleSlug: "evaluate-reverse-polish-notation", difficulty: "Medium" },
  { id: 224, title: "Basic Calculator", titleSlug: "basic-calculator", difficulty: "Hard" },

  // Linked List (11)
  { id: 141, title: "Linked List Cycle", titleSlug: "linked-list-cycle", difficulty: "Easy" },
  { id: 2, title: "Add Two Numbers", titleSlug: "add-two-numbers", difficulty: "Medium" },
  { id: 21, title: "Merge Two Sorted Lists", titleSlug: "merge-two-sorted-lists", difficulty: "Easy" },
  { id: 138, title: "Copy List with Random Pointer", titleSlug: "copy-list-with-random-pointer", difficulty: "Medium" },
  { id: 92, title: "Reverse Linked List II", titleSlug: "reverse-linked-list-ii", difficulty: "Medium" },
  { id: 25, title: "Reverse Nodes in k-Group", titleSlug: "reverse-nodes-in-k-group", difficulty: "Hard" },
  { id: 19, title: "Remove Nth Node From End of List", titleSlug: "remove-nth-node-from-end-of-list", difficulty: "Medium" },
  { id: 82, title: "Remove Duplicates from Sorted List II", titleSlug: "remove-duplicates-from-sorted-list-ii", difficulty: "Medium" },
  { id: 61, title: "Rotate List", titleSlug: "rotate-list", difficulty: "Medium" },
  { id: 86, title: "Partition List", titleSlug: "partition-list", difficulty: "Medium" },
  { id: 146, title: "LRU Cache", titleSlug: "lru-cache", difficulty: "Medium" },

  // Binary Tree General (14)
  { id: 104, title: "Maximum Depth of Binary Tree", titleSlug: "maximum-depth-of-binary-tree", difficulty: "Easy" },
  { id: 100, title: "Same Tree", titleSlug: "same-tree", difficulty: "Easy" },
  { id: 226, title: "Invert Binary Tree", titleSlug: "invert-binary-tree", difficulty: "Easy" },
  { id: 101, title: "Symmetric Tree", titleSlug: "symmetric-tree", difficulty: "Easy" },
  { id: 105, title: "Construct Binary Tree from Preorder and Inorder Traversal", titleSlug: "construct-binary-tree-from-preorder-and-inorder-traversal", difficulty: "Medium" },
  { id: 106, title: "Construct Binary Tree from Inorder and Postorder Traversal", titleSlug: "construct-binary-tree-from-inorder-and-postorder-traversal", difficulty: "Medium" },
  { id: 117, title: "Populating Next Right Pointers in Each Node II", titleSlug: "populating-next-right-pointers-in-each-node-ii", difficulty: "Medium" },
  { id: 114, title: "Flatten Binary Tree to Linked List", titleSlug: "flatten-binary-tree-to-linked-list", difficulty: "Medium" },
  { id: 112, title: "Path Sum", titleSlug: "path-sum", difficulty: "Easy" },
  { id: 129, title: "Sum Root to Leaf Numbers", titleSlug: "sum-root-to-leaf-numbers", difficulty: "Medium" },
  { id: 124, title: "Binary Tree Maximum Path Sum", titleSlug: "binary-tree-maximum-path-sum", difficulty: "Hard" },
  { id: 173, title: "Binary Search Tree Iterator", titleSlug: "binary-search-tree-iterator", difficulty: "Medium" },
  { id: 222, title: "Count Complete Tree Nodes", titleSlug: "count-complete-tree-nodes", difficulty: "Easy" },
  { id: 236, title: "Lowest Common Ancestor of a Binary Tree", titleSlug: "lowest-common-ancestor-of-a-binary-tree", difficulty: "Medium" },

  // Binary Tree BFS (4)
  { id: 199, title: "Binary Tree Right Side View", titleSlug: "binary-tree-right-side-view", difficulty: "Medium" },
  { id: 637, title: "Average of Levels in Binary Tree", titleSlug: "average-of-levels-in-binary-tree", difficulty: "Easy" },
  { id: 102, title: "Binary Tree Level Order Traversal", titleSlug: "binary-tree-level-order-traversal", difficulty: "Medium" },
  { id: 103, title: "Binary Tree Zigzag Level Order Traversal", titleSlug: "binary-tree-zigzag-level-order-traversal", difficulty: "Medium" },

  // Binary Search Tree (3)
  { id: 530, title: "Minimum Absolute Difference in BST", titleSlug: "minimum-absolute-difference-in-bst", difficulty: "Easy" },
  { id: 230, title: "Kth Smallest Element in a BST", titleSlug: "kth-smallest-element-in-a-bst", difficulty: "Medium" },
  { id: 98, title: "Validate Binary Search Tree", titleSlug: "validate-binary-search-tree", difficulty: "Medium" },

  // Graph General (6)
  { id: 200, title: "Number of Islands", titleSlug: "number-of-islands", difficulty: "Medium" },
  { id: 130, title: "Surrounded Regions", titleSlug: "surrounded-regions", difficulty: "Medium" },
  { id: 133, title: "Clone Graph", titleSlug: "clone-graph", difficulty: "Medium" },
  { id: 399, title: "Evaluate Division", titleSlug: "evaluate-division", difficulty: "Medium" },
  { id: 207, title: "Course Schedule", titleSlug: "course-schedule", difficulty: "Medium" },
  { id: 210, title: "Course Schedule II", titleSlug: "course-schedule-ii", difficulty: "Medium" },

  // Graph BFS (3)
  { id: 909, title: "Snakes and Ladders", titleSlug: "snakes-and-ladders", difficulty: "Medium" },
  { id: 433, title: "Minimum Genetic Mutation", titleSlug: "minimum-genetic-mutation", difficulty: "Medium" },
  { id: 127, title: "Word Ladder", titleSlug: "word-ladder", difficulty: "Hard" },

  // Trie (3)
  { id: 208, title: "Implement Trie (Prefix Tree)", titleSlug: "implement-trie-prefix-tree", difficulty: "Medium" },
  { id: 211, title: "Design Add and Search Words Data Structure", titleSlug: "design-add-and-search-words-data-structure", difficulty: "Medium" },
  { id: 212, title: "Word Search II", titleSlug: "word-search-ii", difficulty: "Hard" },

  // Backtracking (7)
  { id: 17, title: "Letter Combinations of a Phone Number", titleSlug: "letter-combinations-of-a-phone-number", difficulty: "Medium" },
  { id: 77, title: "Combinations", titleSlug: "combinations", difficulty: "Medium" },
  { id: 46, title: "Permutations", titleSlug: "permutations", difficulty: "Medium" },
  { id: 39, title: "Combination Sum", titleSlug: "combination-sum", difficulty: "Medium" },
  { id: 52, title: "N-Queens II", titleSlug: "n-queens-ii", difficulty: "Hard" },
  { id: 22, title: "Generate Parentheses", titleSlug: "generate-parentheses", difficulty: "Medium" },
  { id: 79, title: "Word Search", titleSlug: "word-search", difficulty: "Medium" },

  // Divide & Conquer (4)
  { id: 108, title: "Convert Sorted Array to Binary Search Tree", titleSlug: "convert-sorted-array-to-binary-search-tree", difficulty: "Easy" },
  { id: 148, title: "Sort List", titleSlug: "sort-list", difficulty: "Medium" },
  { id: 427, title: "Construct Quad Tree", titleSlug: "construct-quad-tree", difficulty: "Medium" },
  { id: 23, title: "Merge k Sorted Lists", titleSlug: "merge-k-sorted-lists", difficulty: "Hard" },

  // Kadane's Algorithm (2)
  { id: 53, title: "Maximum Subarray", titleSlug: "maximum-subarray", difficulty: "Medium" },
  { id: 918, title: "Maximum Sum Circular Subarray", titleSlug: "maximum-sum-circular-subarray", difficulty: "Medium" },

  // Binary Search (7)
  { id: 35, title: "Search Insert Position", titleSlug: "search-insert-position", difficulty: "Easy" },
  { id: 74, title: "Search a 2D Matrix", titleSlug: "search-a-2d-matrix", difficulty: "Medium" },
  { id: 162, title: "Find Peak Element", titleSlug: "find-peak-element", difficulty: "Medium" },
  { id: 33, title: "Search in Rotated Sorted Array", titleSlug: "search-in-rotated-sorted-array", difficulty: "Medium" },
  { id: 34, title: "Find First and Last Position of Element in Sorted Array", titleSlug: "find-first-and-last-position-of-element-in-sorted-array", difficulty: "Medium" },
  { id: 153, title: "Find Minimum in Rotated Sorted Array", titleSlug: "find-minimum-in-rotated-sorted-array", difficulty: "Medium" },
  { id: 4, title: "Median of Two Sorted Arrays", titleSlug: "median-of-two-sorted-arrays", difficulty: "Hard" },

  // Heap (4)
  { id: 215, title: "Kth Largest Element in an Array", titleSlug: "kth-largest-element-in-an-array", difficulty: "Medium" },
  { id: 502, title: "IPO", titleSlug: "ipo", difficulty: "Hard" },
  { id: 373, title: "Find K Pairs with Smallest Sums", titleSlug: "find-k-pairs-with-smallest-sums", difficulty: "Medium" },
  { id: 295, title: "Find Median from Data Stream", titleSlug: "find-median-from-data-stream", difficulty: "Hard" },

  // Bit Manipulation (6)
  { id: 67, title: "Add Binary", titleSlug: "add-binary", difficulty: "Easy" },
  { id: 190, title: "Reverse Bits", titleSlug: "reverse-bits", difficulty: "Easy" },
  { id: 191, title: "Number of 1 Bits", titleSlug: "number-of-1-bits", difficulty: "Easy" },
  { id: 136, title: "Single Number", titleSlug: "single-number", difficulty: "Easy" },
  { id: 137, title: "Single Number II", titleSlug: "single-number-ii", difficulty: "Medium" },
  { id: 201, title: "Bitwise AND of Numbers Range", titleSlug: "bitwise-and-of-numbers-range", difficulty: "Medium" },

  // Math (6)
  { id: 9, title: "Palindrome Number", titleSlug: "palindrome-number", difficulty: "Easy" },
  { id: 66, title: "Plus One", titleSlug: "plus-one", difficulty: "Easy" },
  { id: 172, title: "Factorial Trailing Zeroes", titleSlug: "factorial-trailing-zeroes", difficulty: "Medium" },
  { id: 69, title: "Sqrt(x)", titleSlug: "sqrtx", difficulty: "Easy" },
  { id: 50, title: "Pow(x, n)", titleSlug: "powx-n", difficulty: "Medium" },
  { id: 149, title: "Max Points on a Line", titleSlug: "max-points-on-a-line", difficulty: "Hard" },

  // 1D DP (5)
  { id: 70, title: "Climbing Stairs", titleSlug: "climbing-stairs", difficulty: "Easy" },
  { id: 198, title: "House Robber", titleSlug: "house-robber", difficulty: "Medium" },
  { id: 139, title: "Word Break", titleSlug: "word-break", difficulty: "Medium" },
  { id: 322, title: "Coin Change", titleSlug: "coin-change", difficulty: "Medium" },
  { id: 300, title: "Longest Increasing Subsequence", titleSlug: "longest-increasing-subsequence", difficulty: "Medium" },

  // Multidimensional DP (9)
  { id: 120, title: "Triangle", titleSlug: "triangle", difficulty: "Medium" },
  { id: 64, title: "Minimum Path Sum", titleSlug: "minimum-path-sum", difficulty: "Medium" },
  { id: 63, title: "Unique Paths II", titleSlug: "unique-paths-ii", difficulty: "Medium" },
  { id: 5, title: "Longest Palindromic Substring", titleSlug: "longest-palindromic-substring", difficulty: "Medium" },
  { id: 97, title: "Interleaving String", titleSlug: "interleaving-string", difficulty: "Medium" },
  { id: 72, title: "Edit Distance", titleSlug: "edit-distance", difficulty: "Medium" },
  { id: 123, title: "Best Time to Buy and Sell Stock III", titleSlug: "best-time-to-buy-and-sell-stock-iii", difficulty: "Hard" },
  { id: 188, title: "Best Time to Buy and Sell Stock IV", titleSlug: "best-time-to-buy-and-sell-stock-iv", difficulty: "Hard" },
  { id: 221, title: "Maximal Square", titleSlug: "maximal-square", difficulty: "Medium" },
];

async function main() {
  console.log("🚀 Starting LeetSquad database seed (Top Interview 150)...");
  await ensureDbInitialized();

  // 1. Initialize system_state single row
  await db
    .insert(system_state)
    .values({ id: 1, lastSyncedAt: null })
    .onConflictDoNothing();
  console.log("✅ system_state initialized.");

  // 2. Seed initial badges
  for (const badge of INITIAL_BADGES) {
    await db
      .insert(badges)
      .values(badge)
      .onConflictDoUpdate({
        target: badges.code,
        set: {
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
        },
      });
  }
  console.log(`✅ Seeded ${INITIAL_BADGES.length} badges.`);

  // 3. Prepare Top Interview 150 problems (optionally syncing metadata with alfa-leetcode-api if running)
  const top150SlugMap = new Map<string, ApiProblemItem>(
    TOP_INTERVIEW_150.map((p) => [p.titleSlug, p])
  );

  try {
    const apiProblems = await fetchProblemsFromApi(3000);
    for (const apiProb of apiProblems) {
      if (top150SlugMap.has(apiProb.titleSlug)) {
        top150SlugMap.set(apiProb.titleSlug, apiProb);
      }
    }
    console.log(
      "📡 Synchronized Top Interview 150 metadata with local alfa-leetcode-api."
    );
  } catch {
    console.log(
      "📦 Using built-in Top Interview 150 problem set (https://leetcode.com/studyplan/top-interview-150/)."
    );
  }

  const problemItems = Array.from(top150SlugMap.values());
  const validIds = problemItems.map((p) => p.id);

  // Remove any previously seeded problems outside Top Interview 150
  await db.delete(problems).where(notInArray(problems.id, validIds));

  // Batch upsert all 150 problems
  const chunkSize = 50;
  for (let i = 0; i < problemItems.length; i += chunkSize) {
    const chunk = problemItems.slice(i, i + chunkSize);
    await db
      .insert(problems)
      .values(
        chunk.map((p) => ({
          id: p.id,
          title: p.title,
          titleSlug: p.titleSlug,
          difficulty: p.difficulty,
        }))
      )
      .onConflictDoUpdate({
        target: problems.id,
        set: {
          title: sql`excluded.title`,
          titleSlug: sql`excluded.title_slug`,
          difficulty: sql`excluded.difficulty`,
        },
      });
  }

  const easyCount = problemItems.filter((p) => p.difficulty === "Easy").length;
  const mediumCount = problemItems.filter(
    (p) => p.difficulty === "Medium"
  ).length;
  const hardCount = problemItems.filter((p) => p.difficulty === "Hard").length;

  console.log(
    `✅ Seeded ${problemItems.length} problems from Top Interview 150 (Easy: ${easyCount}, Medium: ${mediumCount}, Hard: ${hardCount}).`
  );

  // 4. Ensure today's 3 daily challenges are drawn from Top Interview 150
  const todayUtc = getTodayUtcDateString();
  const drawResult = await drawDailyChallengesForDate(todayUtc);
  if (drawResult.alreadyExists) {
    console.log(
      `ℹ️ Daily challenges for ${todayUtc} (${drawResult.drawn.map((d) => `[${d.difficulty}] #${d.problemId} ${d.title}`).join(", ")}) are ready.`
    );
  } else {
    console.log(
      `🎲 Drawn 3 daily challenges for ${todayUtc}:`,
      drawResult.drawn
        .map((d) => `[${d.difficulty}] #${d.problemId} ${d.title}`)
        .join(", ")
    );
  }

  console.log("🎉 Seed completed successfully!");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
