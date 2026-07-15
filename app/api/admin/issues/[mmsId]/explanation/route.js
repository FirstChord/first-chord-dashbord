import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { assistantContextService } from '@/lib/admin/assistant-context-service.mjs';
import { buildIssueExplanation } from '@/lib/admin/issue-explanation-helpers.mjs';
import { isIssueAiBriefingConfigured } from '@/lib/admin/issue-explanation-ai-provider.mjs';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { mmsId } = await params;
  const searchParams = new URL(request.url).searchParams;

  try {
    const result = await assistantContextService.getIssueContext({
      mmsId,
      source: searchParams.get('source'),
      issueType: searchParams.get('issueType'),
    });

    if (!result.context) {
      return Response.json({ error: 'Issue context was not found' }, { status: 404 });
    }

    return Response.json({
      found: result.found,
      explanation: buildIssueExplanation(result.context, { availability: result.availability }),
      aiBriefingAvailable: isIssueAiBriefingConfigured(),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const status = error instanceof TypeError ? 400 : 500;
    return Response.json({
      error: status === 400 ? error.message : 'Issue explanation failed',
    }, { status });
  }
}
