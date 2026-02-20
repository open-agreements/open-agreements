export default async function () {
  const repo = "open-agreements/open-agreements";
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return { stars: null };
    const data = await res.json();
    return { stars: data.stargazers_count ?? null };
  } catch {
    return { stars: null };
  }
}
