#!/bin/bash

# Define the name of the C++ file
filename="client.cpp"

# Compile the C++ program using GCC
g++ -o prog -g client.cpp $(pkg-config --cflags --libs sdl2)
# g++ -o prog -g client.cpp 
# Check if the compilation was successful
if [ $? -eq 0 ]; then
    # Run the program
    ./prog
else
    echo "Compilation failed"
fi