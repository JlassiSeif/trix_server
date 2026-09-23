#include <SDL.h>
#include "src/game.h"
#include "src/deck.h"
#include <iostream>

int main(int argc, char *args[])
{
    // Initialize SDL
    SDL_Init(SDL_INIT_VIDEO);
    SDL_Window *window = SDL_CreateWindow("TRIX", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, 800, 600, 0);
    SDL_Renderer *renderer = SDL_CreateRenderer(window, -1, 0);
    SDL_bool isDragging = SDL_FALSE;
    game f = game(renderer);
    SDL_Event event;
    // Game loop
    bool running = true;
    while (running)
    {
        // Handle events
        SDL_Event event;
        while (SDL_PollEvent(&event))
        {
            switch (event.type)
            {
            case SDL_QUIT:
                goto end_loop;
            case SDL_MOUSEBUTTONDOWN:
                if (event.button.button == SDL_BUTTON_LEFT)
                {
                    if (f.check_mouse(event.button.x, event.button.y))
                    {
                        isDragging = SDL_TRUE;
                    }
                }
                break;
            case SDL_MOUSEBUTTONUP:
                if (event.button.button == SDL_BUTTON_LEFT)
                {
                    f.drop_card(event.button.x, event.button.y);
                    isDragging = SDL_FALSE;
                }
                break;
            case SDL_MOUSEMOTION:
                if (isDragging)
                {
                    f.move_rect(event.motion.x, event.motion.y);
                }
                break;
            }
        }

        // Clear screen
        SDL_SetRenderDrawColor(renderer, 0, 64, 64, 255);
        SDL_RenderClear(renderer);

        // render graphics
        f.render(renderer);

        // Update screen
        SDL_RenderPresent(renderer);
    }

end_loop:
    SDL_DestroyRenderer(renderer);
    SDL_DestroyWindow(window);
    SDL_Quit();
    return 0;
}