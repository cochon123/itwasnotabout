#!/usr/bin/env python3
"""
Test script for the Reddit story fetcher
"""
import os
import sys

# Add the backend scripts directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend', 'scripts'))

from fetch_reddit_stories import fetch_reddit_stories

def main():
    # Test with a small number of stories
    output_file = os.path.join(os.path.dirname(__file__), 'backend', 'data', 'test_reddit_stories.md')
    print("Testing Reddit story fetcher...")
    success = fetch_reddit_stories(output_file, "stories", 2)
    
    if success:
        print("Test successful! Check the output file.")
        # Show a preview of the fetched stories
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                content = f.read()
                # Show first 500 characters
                print("\nPreview of fetched stories:")
                print(content[:500] + "..." if len(content) > 500 else content)
        except Exception as e:
            print(f"Could not read output file: {e}")
    else:
        print("Test failed!")

if __name__ == '__main__':
    main()