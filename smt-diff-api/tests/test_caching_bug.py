from smt_diff.smt_diff import get_cache_info, get_next_witness, store_witness


def test_caching_with_declare_sort():
    """Test that store_witness works with declare-sort specifications."""
    s1 = """
    (declare-sort User)
    (declare-fun is_admin (User) Bool)
    (declare-const Alice User)
    (assert (is_admin Alice))
    """

    s2 = """
    (declare-sort User)
    (declare-fun is_admin (User) Bool)
    (declare-const Alice User)
    (assert (not (is_admin Alice)))
    """

    spec_id = store_witness(s1, s2, analysis="not-previous-but-current", filter="")

    assert spec_id is not None, "store_witness should return a spec_id"

    cache_info = get_cache_info(spec_id)
    assert cache_info is not None, "Cache should exist for the spec_id"

    first_witness = get_next_witness(spec_id)
    assert first_witness is not None, "First witness should be available"
    assert "is_admin" in first_witness, "Witness should contain is_admin function"
    assert "Alice" in first_witness, "Witness should contain Alice constant"


def test_multiple_witnesses_from_cache():
    """Test that multiple witnesses can be retrieved from the same cache."""
    s1 = """
    (declare-const x Int)
    (assert (> x 0))
    (assert (< x 5))
    """

    s2 = """
    (declare-const x Int)
    (assert (> x 2))
    (assert (< x 8))
    """

    spec_id = store_witness(s1, s2, analysis="not-previous-but-current", filter="")
    assert spec_id is not None

    witness1 = get_next_witness(spec_id)
    assert witness1 is not None, "First witness should exist"

    witness2 = get_next_witness(spec_id)
    assert witness2 is not None, "Second witness should exist"

    assert witness1 != witness2, "Different calls should return different witnesses"


def test_cache_with_uninterpreted_functions():
    """Test caching with uninterpreted functions in both analysis directions."""
    s1 = """
    (declare-sort User)
    (declare-fun is_admin (User) Bool)
    (declare-const Alice User)
    (assert (is_admin Alice))
    """

    s2 = """
    (declare-sort User)
    (declare-fun is_admin (User) Bool)
    (declare-const Alice User)
    (assert (not (is_admin Alice)))
    """

    spec_id_1 = store_witness(s1, s2, analysis="not-previous-but-current", filter="")
    assert spec_id_1 is not None
    witness_1 = get_next_witness(spec_id_1)
    assert witness_1 is not None
    assert "false" in witness_1.lower() or "False" in witness_1

    spec_id_2 = store_witness(s1, s2, analysis="not-current-but-previous", filter="")
    assert spec_id_2 is not None
    witness_2 = get_next_witness(spec_id_2)
    assert witness_2 is not None
    assert "true" in witness_2.lower() or "True" in witness_2


def test_common_witness_caching():
    """Test that common witness computation works with caching."""
    s1 = """
    (declare-const x Int)
    (declare-const y Int)
    (assert (> x 0))
    (assert (> y 0))
    """

    s2 = """
    (declare-const x Int)
    (declare-const y Int)
    (assert (< x 10))
    (assert (< y 10))
    """

    spec_id = store_witness(s1, s2, analysis="common-witness", filter="")
    assert spec_id is not None

    witness = get_next_witness(spec_id)
    assert witness is not None
    assert "define-fun x" in witness
    assert "define-fun y" in witness


def test_error_message_caching():
    """Test that error messages are properly cached."""
    s1 = "(declare-const x Int"  # Missing closing paren
    s2 = "(declare-const y Int)"

    spec_id = store_witness(s1, s2, analysis="not-previous-but-current", filter="")
    assert spec_id is not None

    result = get_next_witness(spec_id)
    assert result is not None
    assert "color: red" in result or "Error" in result
