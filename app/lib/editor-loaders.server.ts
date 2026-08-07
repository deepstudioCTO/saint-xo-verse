import { eq } from "drizzle-orm";
import { editorProjects, workflowRuns, workflowTemplates } from "./db.server";
import type { EditorEntryData, GraphData } from "~/components/editor/editorTypes";
import type { Node, Edge, Viewport } from "@xyflow/react";

type Db = ReturnType<typeof import("./db.server").getDb>;

/** UUID v4 형식 체크 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 항등 viewport(원점·배율1)는 "저장된 뷰 없음"으로 취급한다.
 *
 * `workflow_templates.viewport`의 스키마 기본값이 바로 이 값이라, 시드/생성 시 뷰를
 * 지정하지 않은 템플릿도 viewport를 갖게 된다. 그러면 EditorCanvas의
 * `useFitView = !startViewport`가 false가 되어 fitView가 꺼지고, 그래프가 화면 원점에
 * 그려져 좌상단 노드가 노드 팔레트에 가려진다. 실제로 사용자가 원점·배율1로 저장한
 * 경우에도 fitView가 걸릴 뿐이라 손해가 없다.
 */
function isIdentityViewport(v: Viewport): boolean {
  return v.x === 0 && v.y === 0 && v.zoom === 1;
}

function parseGraph(nodesJson: string, edgesJson: string, viewportJson?: string | null): GraphData | null {
  try {
    const nodes = JSON.parse(nodesJson) as Node[];
    const edges = JSON.parse(edgesJson) as Edge[];
    const parsedViewport = viewportJson ? (JSON.parse(viewportJson) as Viewport) : undefined;
    const viewport =
      parsedViewport && !isIdentityViewport(parsedViewport) ? parsedViewport : undefined;
    // Ensure all nodes have positions
    const nodesWithPositions = nodes.map((n, i) => ({
      ...n,
      position: n.position || { x: i * 280, y: 100 },
    }));
    return nodesWithPositions.length > 0 ? { nodes: nodesWithPositions, edges, viewport } : null;
  } catch {
    return null;
  }
}

export async function loadFromRun(db: Db, runId: string): Promise<EditorEntryData | null> {
  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, runId))
    .limit(1);

  if (!run) return null;

  try {
    const snap = JSON.parse(run.templateSnapshot) as { nodes?: Node[]; edges?: Edge[] };
    const graph = parseGraph(
      JSON.stringify(snap.nodes || []),
      JSON.stringify(snap.edges || []),
    );
    if (!graph) return null;
    return { mode: "run", graph, runId: run.id };
  } catch {
    console.error("Failed to parse run templateSnapshot:", run.id);
    return null;
  }
}

export async function loadFromTemplate(db: Db, templateIdOrName: string): Promise<EditorEntryData | null> {
  const isUuid = UUID_RE.test(templateIdOrName);
  const [template] = await db
    .select()
    .from(workflowTemplates)
    .where(
      isUuid
        ? eq(workflowTemplates.id, templateIdOrName)
        : eq(workflowTemplates.name, templateIdOrName)
    )
    .limit(1);

  if (!template) return null;

  const graph = parseGraph(template.nodes, template.edges, template.viewport);
  if (!graph) return null;
  return { mode: "template", graph, templateId: template.id, templateMeta: { name: template.name, category: template.category } };
}

export async function loadSavedProject(db: Db): Promise<EditorEntryData | null> {
  const [saved] = await db
    .select()
    .from(editorProjects)
    .where(eq(editorProjects.id, "default"))
    .limit(1);

  if (!saved) return null;

  const graph = parseGraph(saved.nodes, saved.edges, saved.viewport);
  if (!graph) return null;
  return { mode: "scratch", graph };
}
