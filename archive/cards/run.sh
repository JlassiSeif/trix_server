#!/bin/bash

# Define the name of the C++ file
filename="client.cpp"

# Compile the C++ program using GCC
g++ -o prog client.cpp 
#g++ -o prog main.cpp $(pkg-config --cflags --libs sdl2)

# Check if the compilation was successful
if [ $? -eq 0 ]; then
    # Run the program
    ./prog
else
    echo "Compilation failed"
fi