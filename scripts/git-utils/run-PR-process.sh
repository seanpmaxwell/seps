# Create a branch with a single commit and an A.I. generated message
bash ./scripts/git-utils/squash-commit-history.sh;

# Create a pull request for the current branch against main

# Run a continuous loop and check every 5 seconds if every CI test has passed
# If there are any errors print a message exit the script

# If there are no errors merge the pull request
# Wait 5 seconds and somehow check if the merging is done

# If merge is done then run the post-PR-cleanup.sh script