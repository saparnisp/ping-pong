#!/bin/bash

# Array of repository names
repos=(blokeliai1 blokeliai2 blokeliai3 blokeliai4 blokeliai5 blokeliai6 blokeliai7 blokeliai8 blokeliai9)

# Loop through each repository and push updates
for repo in "${repos[@]}"
do
    echo "Pushing updates to $repo..."
    git push -f $repo main
done

echo "All updates have been pushed!"
