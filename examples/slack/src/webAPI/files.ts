/**
 * Slack Files Module - Phase 2A Implementation
 * Implements: FILE-001, FILE-002
 */

import type { User } from '../util'
import type { SlackAPIResponse } from './types'
import { validateUserAuth } from './auth'
import { clientPool, handleSlackResponse, SlackAPIError } from './client'
import { resolveConversationId } from './utils'

/**
 * FILE-001: listFiles - Phase 2A Implementation
 */
export async function listFiles(
  user: User,
  conversationIdentifier?: string,
  types?: string,
  limit?: number,
  page?: number
): Promise<{ success: boolean, files: any[], totalFiles?: number, nextPageCursor?: string, error?: string }> {
  try {
    console.log('📁 Listing files:', {
      conversationIdentifier,
      types,
      limit,
      page
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)

    return handleSlackResponse(async () => {
      const queryParams: any = {
        count: limit || 20,
        page: page || 1
      }

      if (conversationIdentifier) {
        // Resolve conversation ID if needed
        try {
          const resolvedId = await resolveConversationId(client, conversationIdentifier, {
            includePrivate: true,
            includeArchived: false,
            allowDMs: true
          });
          queryParams.channel = resolvedId
        } catch (error) {
          console.error('❌ Failed to resolve conversation for file listing:', error);
          throw error;
        }
      }

      if (types && types.trim()) {
        queryParams.types = types // types is already a comma-separated string
      }

      const result = await client.files.list(queryParams)

      if (!result.ok) {
        throw new SlackAPIError(`Failed to list files: ${result.error}`, 'API_ERROR')
      }

      const files = (result.files || []).map((file: any) => ({
        id: file.id,
        name: file.name,
        title: file.title,
        mimetype: file.mimetype,
        filetype: file.filetype,
        pretty_type: file.pretty_type,
        user: file.user,
        created: file.created,
        timestamp: file.timestamp,
        size: file.size,
        mode: file.mode,
        is_external: file.is_external,
        external_type: file.external_type,
        is_public: file.is_public,
        public_url_shared: file.public_url_shared,
        display_as_bot: file.display_as_bot,
        username: file.username,
        url_private: file.url_private,
        url_private_download: file.url_private_download,
        permalink: file.permalink,
        permalink_public: file.permalink_public,
        edit_link: file.edit_link,
        preview: file.preview,
        preview_highlight: file.preview_highlight,
        lines: file.lines,
        lines_more: file.lines_more,
        preview_is_truncated: file.preview_is_truncated,
        comments_count: file.comments_count,
        is_starred: file.is_starred,
        shares: file.shares,
        channels: file.channels,
        groups: file.groups,
        ims: file.ims,
        has_rich_preview: file.has_rich_preview
      }))

      console.log(`✅ Retrieved ${files.length} files`)

      return {
        success: true,
        files,
        totalFiles: (result.paging as any)?.total,
        nextPageCursor: (result.paging as any)?.page < (result.paging as any)?.pages ? 
          String((result.paging as any)?.page + 1) : undefined
      }

    }, 'listFiles')

  } catch (error) {
    console.error('❌ Failed to list files:', error)
    
    if (error instanceof SlackAPIError) {
      return {
        success: false,
        files: [],
        error: error.message
      }
    }

    return {
      success: false,
      files: [],
      error: `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * FILE-002: uploadFile - Phase 2A Implementation
 */
export async function uploadFile(
  user: User,
  conversationIdentifier: string,
  file: Buffer | string,
  filename: string,
  title?: string,
  initialComment?: string,
  filetype?: string
): Promise<{ success: boolean, file?: any, error?: string }> {
  try {
    console.log('📤 Uploading file:', {
      conversationIdentifier,
      filename,
      title,
      hasComment: !!initialComment,
      filetype
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)

    // Resolve conversation ID if needed
    let resolvedConversationId;
    try {
      resolvedConversationId = await resolveConversationId(client, conversationIdentifier, {
        includePrivate: true,
        includeArchived: false,
        allowDMs: true
      });
    } catch (error) {
      console.error('❌ Failed to resolve conversation for file upload:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const uploadParams: any = {
        channels: resolvedConversationId,
        filename,
        file
      }

      if (title) {
        uploadParams.title = title
      }

      if (initialComment) {
        uploadParams.initial_comment = initialComment
      }

      if (filetype) {
        uploadParams.filetype = filetype
      }

      const result = await client.files.upload(uploadParams)

      if (!result.ok) {
        throw new SlackAPIError(`Failed to upload file: ${result.error}`, 'API_ERROR')
      }

      console.log(`✅ File uploaded successfully: ${result.file?.id}`)

      return {
        success: true,
        file: result.file ? {
          id: result.file.id,
          name: result.file.name,
          title: result.file.title,
          mimetype: result.file.mimetype,
          filetype: result.file.filetype,
          pretty_type: result.file.pretty_type,
          user: result.file.user,
          created: result.file.created,
          timestamp: result.file.timestamp,
          size: result.file.size,
          url_private: result.file.url_private,
          url_private_download: result.file.url_private_download,
          permalink: result.file.permalink,
          permalink_public: result.file.permalink_public
        } : undefined
      }

    }, 'uploadFile')

  } catch (error) {
    console.error('❌ Failed to upload file:', error)
    
    if (error instanceof SlackAPIError) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
} 