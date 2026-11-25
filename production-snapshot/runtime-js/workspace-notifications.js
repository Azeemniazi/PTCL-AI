import { Router } from 'express';
const reconcile = `
WITH imports AS (
  SELECT b.id, b.created_at, b.cancelled_at, b.is_shared, f.id AS folder_id,
    count(i.id) AS total,
    count(i.id) FILTER (WHERE i.status IN ('uploaded','skipped') AND d.id IS NOT NULL) AS placed,
    count(i.id) FILTER (WHERE i.indexing_supported AND d.status='indexing') AS processing,
    count(i.id) FILTER (WHERE d.status='ready') AS searchable,
    count(i.id) FILTER (WHERE i.indexing_supported AND d.status='failed') AS failed,
    max(d.created_at) AS upload_time, max(d.updated_at) AS index_time
  FROM knowledge_imports b
  LEFT JOIN knowledge_import_items i ON i.import_id=b.id
  LEFT JOIN knowledge_documents d ON d.id=i.document_id
  LEFT JOIN knowledge_folders f ON f.id=b.destination_id AND (f.is_shared OR f.user_id=$1)
  WHERE b.user_id=$1 AND b.created_at > now()-interval '30 days'
  GROUP BY b.id, f.id
), destinations AS (
  SELECT imports.*, '#documents?scope=' || CASE WHEN is_shared THEN 'shared' ELSE 'personal' END
    || coalesce('&folder=' || folder_id::text,'') AS href FROM imports
), events AS (
  SELECT 'import:' || id || ':upload' AS key, 'Import complete' AS title,
    placed || ' files placed.' AS body, href, coalesce(upload_time,created_at) AS happened
  FROM destinations WHERE cancelled_at IS NULL AND placed=total
  UNION ALL
  SELECT 'import:' || id || ':cancel', 'Import cancelled', placed || ' files kept.', href, cancelled_at
  FROM destinations WHERE cancelled_at IS NOT NULL
  UNION ALL
  SELECT 'import:' || id || ':index', CASE WHEN failed>0 THEN 'Indexing needs attention' ELSE 'Import indexing finished' END,
    searchable || ' searchable · ' || failed || ' need attention.', href, coalesce(index_time,created_at)
  FROM destinations WHERE (cancelled_at IS NOT NULL OR placed=total) AND processing=0 AND searchable+failed>0
  UNION ALL
  SELECT 'meeting:' || id || ':' || status, CASE WHEN status='completed' THEN 'Meeting ready' ELSE 'Meeting needs attention' END,
    title, '#meetings/' || id, updated_at
  FROM meetings WHERE owner_id=$1 AND status IN ('completed','failed') AND updated_at > now()-interval '30 days'
  UNION ALL
  SELECT 'image:' || id || ':' || status, CASE WHEN status='completed' THEN 'Image ready' ELSE 'Image job needs attention' END,
    CASE WHEN status='completed' THEN 'Your result is available in Image Studio.' ELSE 'Open Image Studio to review the job.' END,
    '#images?job=' || id, coalesce(completed_at,started_at)
  FROM image_jobs WHERE user_id=$1 AND status IN ('completed','failed') AND coalesce(completed_at,started_at)>now()-interval '30 days'
)
INSERT INTO workspace_notifications(user_id,event_key,title,body,href,occurred_at)
SELECT $1,key,title,body,href,happened FROM events
ON CONFLICT (user_id,event_key) DO NOTHING
`;
export function workspaceNotifications(pool) {
    const router = Router();
    router.get('/', async (req, res) => {
        res.setHeader('Cache-Control', 'private, no-store');
        if (!pool)
            return res.json({ entries: [], unread: 0 });
        const owner = req.session.user.id;
        await pool.query(reconcile, [owner]);
        const { rows } = await pool.query(`
      SELECT event_key AS id,title,body AS text,href,occurred_at AS time, read_at IS NULL AS unread
      FROM workspace_notifications WHERE user_id=$1 AND dismissed_at IS NULL
      ORDER BY occurred_at DESC,event_key LIMIT 25`, [owner]);
        return res.json({ entries: rows, unread: rows.filter(row => row.unread).length });
    });
    router.post('/:action', async (req, res) => {
        const action = req.params.action;
        const ids = req.body?.ids;
        if ((action !== 'read' && action !== 'clear') || !Array.isArray(ids) ||
            ids.length > 25 || ids.some(id => typeof id !== 'string' || id.length > 120))
            return res.sendStatus(400);
        if (pool)
            await pool.query(`
      UPDATE workspace_notifications SET read_at=coalesce(read_at,now()),
        dismissed_at=CASE WHEN $3 THEN coalesce(dismissed_at,now()) ELSE dismissed_at END
      WHERE user_id=$1 AND ($3 OR event_key=ANY($2::text[]))`, [req.session.user.id, ids, action === 'clear']);
        return res.sendStatus(204);
    });
    return router;
}
