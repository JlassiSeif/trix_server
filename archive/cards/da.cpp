#include <SDL.h>
#include "src/game.h"
#include <iostream>

const int SCREEN_WIDTH = 640;
const int SCREEN_HEIGHT = 480;

int main(int argc, char *args[])
{
    // Initialize SDL
    SDL_Init(SDL_INIT_VIDEO);
    SDL_Window *window = SDL_CreateWindow("Textured Rectangle", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, SCREEN_WIDTH, SCREEN_HEIGHT, 0);
    SDL_Renderer *renderer = SDL_CreateRenderer(window, -1, 0);

    // Load texture for rectangle
    SDL_Surface *surface = SDL_LoadBMP("assets/cards/7_c.bmp");
    SDL_Texture *texture = SDL_CreateTextureFromSurface(renderer, surface);
    SDL_FreeSurface(surface);

    // Create rectangle
    SDL_Rect rect = {100, 100, 79, 123};
    // SDL_QueryTexture(texture, nullptr, nullptr, &rectangle.w, &rectangle.h);
    // rectangle.x = (SCREEN_WIDTH - rectangle.w) / 2;
    // rectangle.y = (SCREEN_HEIGHT - rectangle.h) / 2;

    SDL_bool isDragging = SDL_FALSE;

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
                    int mouseX = event.button.x;
                    int mouseY = event.button.y;
                    if (mouseX >= rect.x && mouseX <= rect.x + rect.w && mouseY >= rect.y && mouseY <= rect.y + rect.h)
                    {
                        isDragging = SDL_TRUE;
                    }
                }
                break;
            case SDL_MOUSEBUTTONUP:
                if (event.button.button == SDL_BUTTON_LEFT)
                {
                    isDragging = SDL_FALSE;
                }
                break;
            case SDL_MOUSEMOTION:
                if (isDragging)
                {
                    int mouseX = event.motion.x;
                    int mouseY = event.motion.y;
                    rect.x = mouseX - rect.w / 2;
                    rect.y = mouseY - rect.h / 2;
                }
                break;
            }
        }

        // Clear screen
        SDL_SetRenderDrawColor(renderer, 0, 0, 0, 255);
        SDL_RenderClear(renderer);

        // Render textured rectangle
        SDL_RenderCopy(renderer, texture, nullptr, &rect);

        // Update screen
        SDL_RenderPresent(renderer);
    }

end_loop:
    SDL_DestroyTexture(texture);
    SDL_DestroyRenderer(renderer);
    SDL_DestroyWindow(window);
    SDL_Quit();
    return 0;
}