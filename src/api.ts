interface Contribution {
      date: string;
      count: number;
      time: string;
}

interface RepoRequest {
      repoName: string;
      user: string;
      email: string;
      total: number;
      contributions: Contribution[];
}

const API_URL = import.meta.env.API_URL || 'http://127.0.0.1:8000';

export async function generateRepo(data: RepoRequest): Promise<Blob> {
      const response = await fetch(`${API_URL}/generate-repo`, {
            method: 'POST',
            headers: {
                  'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
      });

      if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to generate repository');
      }

      return response.blob();
}