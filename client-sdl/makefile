CXX = g++
CXXFLAGS = -Wall -Wextra -Wpedantic -std=c++17 $(shell pkg-config --cflags sdl2)
LDFLAGS = $(shell pkg-config --libs sdl2)

# Program name
PROGRAM = myprogram

# Source files
SOURCES = pl.cpp

# Object files
OBJECTS = $(SOURCES:.cpp=.o)

# Rule to build the program
$(PROGRAM): $(OBJECTS)
	$(CXX) $(CXXFLAGS) $(OBJECTS) -o $(PROGRAM) $(LDFLAGS)

# Rule to build object files
%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

# Clean rule to remove object files and the program
clean:
	rm -f $(OBJECTS) $(PROGRAM)
