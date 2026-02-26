using System;

namespace DebugTest
{
    class Program
    {
        static void Main(string[] args)
        {
            int a = 1;
            int b = 2;
            Console.WriteLine($"Before swap: a={a}, b={b}");
            int temp = a;  // Set breakpoint here (line 12)
            a = b;
            b = temp;
            Console.WriteLine($"After swap: a={a}, b={b}");

            int result = Add(3, 4);
            Console.WriteLine($"Add(3, 4) = {result}");
        }

        static int Add(int x, int y)
        {
            int sum = x + y;  // Set breakpoint here (line 22) for step-into test
            return sum;
        }
    }
}
