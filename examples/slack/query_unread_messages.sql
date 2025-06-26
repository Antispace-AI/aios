-- Query to show all unread messages in the database
-- This helps troubleshoot unread message counts and states

-- First, show a summary of unread counts by user and conversation
SELECT 
    u.anti_id,
    u.slack_user_name,
    c.display_name AS conversation_name,
    c.type AS conversation_type,
    c.unread_count,
    c.unread_count_display,
    c.last_read_ts,
    c.last_message_ts,
    c.last_message_preview,
    c.is_muted,
    c.updated_at AS conversation_updated_at
FROM conversations c
JOIN users u ON c.user_id = u.id
WHERE c.unread_count > 0
ORDER BY u.anti_id, c.unread_count DESC, c.updated_at DESC;

-- Show detailed unread messages
-- Messages are considered unread if they're newer than the last_read_ts
SELECT 
    u.anti_id,
    u.slack_user_name AS reader_name,
    c.display_name AS conversation_name,
    c.type AS conversation_type,
    c.last_read_ts,
    m.message_ts,
    m.text,
    m.slack_user_name AS sender_name,
    m.message_type,
    m.subtype,
    m.thread_ts,
    m.slack_timestamp,
    m.created_at,
    CASE 
        WHEN c.last_read_ts IS NULL THEN 'NO_READ_STATE'
        WHEN m.message_ts > c.last_read_ts THEN 'UNREAD'
        ELSE 'READ'
    END AS read_status
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN users u ON m.user_id = u.id
WHERE 
    -- Only show messages that should be unread
    (c.last_read_ts IS NULL OR m.message_ts > c.last_read_ts)
    AND m.is_deleted = false
    AND m.message_type != 'tombstone'
ORDER BY 
    u.anti_id, 
    c.display_name, 
    m.slack_timestamp DESC,
    m.message_ts DESC;

-- Summary statistics
SELECT 
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT c.id) AS conversations_with_unread,
    SUM(c.unread_count) AS total_unread_count,
    AVG(c.unread_count) AS avg_unread_per_conversation,
    MAX(c.unread_count) AS max_unread_in_single_conversation
FROM conversations c
JOIN users u ON c.user_id = u.id
WHERE c.unread_count > 0;

-- Show users with the most unread messages
SELECT 
    u.anti_id,
    u.slack_user_name,
    COUNT(c.id) AS conversations_with_unread,
    SUM(c.unread_count) AS total_unread_messages,
    MAX(c.unread_count) AS max_unread_in_single_conversation,
    u.updated_at AS last_user_update
FROM users u
JOIN conversations c ON u.id = c.user_id
WHERE c.unread_count > 0
GROUP BY u.id, u.anti_id, u.slack_user_name, u.updated_at
ORDER BY total_unread_messages DESC;

-- Check for any inconsistencies (conversations with unread count but no unread messages)
SELECT 
    u.anti_id,
    c.display_name AS conversation_name,
    c.unread_count,
    c.last_read_ts,
    c.last_message_ts,
    actual_unread.count AS actual_unread_count,
    CASE 
        WHEN c.unread_count != COALESCE(actual_unread.count, 0) THEN 'MISMATCH'
        ELSE 'OK'
    END AS consistency_check
FROM conversations c
JOIN users u ON c.user_id = u.id
LEFT JOIN (
    SELECT 
        conversation_id,
        COUNT(*) as count
    FROM messages m
    JOIN conversations c2 ON m.conversation_id = c2.id
    WHERE 
        (c2.last_read_ts IS NULL OR m.message_ts > c2.last_read_ts)
        AND m.is_deleted = false
        AND m.message_type != 'tombstone'
    GROUP BY conversation_id
) actual_unread ON c.id = actual_unread.conversation_id
WHERE c.unread_count > 0 OR actual_unread.count > 0
ORDER BY consistency_check DESC, c.unread_count DESC; 