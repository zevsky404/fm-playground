package de.buw.fmp.alloy.api;

import edu.mit.csail.sdg.alloy4.A4Reporter;
import edu.mit.csail.sdg.alloy4.XMLNode;
import edu.mit.csail.sdg.ast.Expr;
import edu.mit.csail.sdg.parser.CompModule;
import edu.mit.csail.sdg.parser.CompUtil;
import edu.mit.csail.sdg.translator.A4Options;
import edu.mit.csail.sdg.translator.A4Solution;
import edu.mit.csail.sdg.translator.A4SolutionReader;
import edu.mit.csail.sdg.translator.TranslateAlloyToKodkod;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Collections;
import org.junit.jupiter.api.Test;

public class MiscTest {

  @Test
  void testFormat() throws IOException {
    A4Options options = new A4Options();
    CompModule m = CompUtil.parseEverything_fromString(A4Reporter.NOP, Specs.TRAFFIC_CODE.code);
    A4Solution instance =
        TranslateAlloyToKodkod.execute_command(
            A4Reporter.NOP, m.getAllReachableSigs(), m.getAllCommands().get(0), options);
    System.out.println(instance.toString(0));
    System.out.println(instance.format(0));
    // create temp file
    String tempFile = Files.createTempFile("alloy", ".als").toAbsolutePath().toString();
    // Pass empty list to work around Alloy 6.2.0 bug where null extraSkolems causes NPE
    instance.writeXML(tempFile, Collections.emptyList());
    System.out.println("XML written to: " + tempFile);
    XMLNode x = new XMLNode(new File(tempFile));
    A4Solution sol = A4SolutionReader.read(m.getAllReachableSigs(), x);
    System.out.println(sol.toString(0));
    System.out.println(sol.format(0));
    Expr e = CompUtil.parseOneExpression_fromString(m, "Car");
    System.out.println(sol.eval(e));
  }
}
