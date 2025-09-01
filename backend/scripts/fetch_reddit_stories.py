#!/usr/bin/env python3
"""
Fetches stories from Reddit to use as input for video generation.
"""
import argparse
import sys
import os
import json
from datetime import datetime
from dotenv import load_dotenv

def fetch_reddit_stories(output_file, subreddit="stories", limit=10):
    """
    Fetch stories from Reddit and save them in the same format as sample.md
    
    Args:
        output_file (str): Path to output file
        subreddit (str): Subreddit to fetch from
        limit (int): Number of stories to fetch
    """
    try:
        # Load environment variables
        load_dotenv()
        
        # Import praw
        try:
            import praw
        except ImportError:
            raise RuntimeError(
                "The package 'praw' is missing. Please install it via 'pip install praw' "
                "or add it to backend/requirements.txt and reinstall dependencies."
            )
            
        # Reddit API credentials
        client_id = os.getenv("REDDIT_CLIENT_ID")
        client_secret = os.getenv("REDDIT_CLIENT_SECRET")
        user_agent = os.getenv("REDDIT_USER_AGENT", "script:storyfetcher:v1.0 (by u/yourusername)")
        
        if not client_id or not client_secret:
            raise RuntimeError(
                "Please set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in your .env file. "
                "Create a Reddit app at https://www.reddit.com/prefs/apps to get these credentials."
            )
            
        # Initialize Reddit instance
        reddit = praw.Reddit(
            client_id=client_id,
            client_secret=client_secret,
            user_agent=user_agent
        )
        
        # Access the subreddit
        subreddit_instance = reddit.subreddit(subreddit)
        
        # Fetch stories
        stories = []
        for i, post in enumerate(subreddit_instance.hot(limit=limit)):
            # Only include text posts that are stories
            if post.is_self and len(post.selftext) > 200:  # Minimum length for a story
                # Format the timestamp
                created_utc = datetime.utcfromtimestamp(post.created_utc).strftime('%Y-%m-%d %H:%M:%S')
                
                # Create story entry
                story_entry = {
                    "title": f"Story {i+1}: {post.title}",
                    "author": str(post.author) if post.author else "Unknown",
                    "url": post.url,
                    "score": post.score,
                    "comments": post.num_comments,
                    "created": created_utc,
                    "content": post.selftext
                }
                stories.append(story_entry)
                
                # Stop after collecting enough valid stories
                if len(stories) >= limit:
                    break
        
        if not stories:
            print(f"No suitable stories found in r/{subreddit}")
            return False
            
        # Format stories for output
        formatted_stories = []
        for i, story in enumerate(stories, 1):
            formatted_story = f"# {story['title']}\n\n"
            formatted_story += f"Author: u/{story['author']}\n"
            formatted_story += f"URL: {story['url']}\n"
            formatted_story += f"Score: {story['score']} upvotes\n"
            formatted_story += f"Comments: {story['comments']}\n"
            formatted_story += f"Posted: {story['created']}\n\n"
            formatted_story += story['content']
            formatted_stories.append(formatted_story)
        
        # Save to file
        output_content = "\n\n\n".join(formatted_stories)
        
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(output_content)
            
        print(f"Successfully fetched {len(stories)} stories from r/{subreddit}")
        print(f"Stories saved to {output_file}")
        
        # Save metadata
        meta_file = os.path.splitext(output_file)[0] + '_meta.json'
        meta = {
            'subreddit': subreddit,
            'stories_count': len(stories),
            'fetch_time': datetime.now().isoformat(),
            'stories': [
                {
                    'title': s['title'],
                    'author': s['author'],
                    'url': s['url'],
                    'score': s['score'],
                    'comments': s['comments'],
                    'created': s['created']
                }
                for s in stories
            ]
        }
        with open(meta_file, 'w', encoding='utf-8') as mf:
            json.dump(meta, mf, ensure_ascii=False, indent=2)
            
        return True
        
    except Exception as e:
        print(f"Error fetching stories: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(
        description="Fetch stories from Reddit for video generation"
    )
    parser.add_argument(
        'output_file',
        nargs='?',
        default=os.path.normpath(os.path.join(os.path.dirname(__file__), '../data/reddit_stories.md')),
        help='Output file for fetched stories'
    )
    parser.add_argument(
        '--subreddit',
        default='stories',
        help='Subreddit to fetch stories from (default: stories)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=5,
        help='Number of stories to fetch (default: 5)'
    )
    args = parser.parse_args()
    
    success = fetch_reddit_stories(args.output_file, args.subreddit, args.limit)
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
